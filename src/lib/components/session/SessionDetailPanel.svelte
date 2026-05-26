<script lang="ts">
	import { selectedSession } from '$lib/stores/sessions';
	import { getSessionMessages, getSessionDiff, abortSession, forkSession, deleteSession } from '$lib/opencode/client';
	import { formatCost, formatRelativeTime } from '$lib/utils/format';
	import { onMount } from 'svelte';

	let {
		sessionId,
		onClose,
	}: {
		sessionId: string;
		onClose: () => void;
	} = $props();

	let activeTab = $state<'chat' | 'diff' | 'cost' | 'tools'>('chat');
	let messages = $state<unknown[]>([]);
	let diffContent = $state<string>('');
	let isLoading = $state(true);

	const tabs = [
		{ id: 'chat' as const, label: 'Chat' },
		{ id: 'diff' as const, label: 'Diff' },
		{ id: 'cost' as const, label: 'Cost' },
		{ id: 'tools' as const, label: 'Tools' },
	];

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		const [msgResult, diffResult] = await Promise.allSettled([
			getSessionMessages(sessionId),
			getSessionDiff(sessionId),
		]);

		if (msgResult.status === 'fulfilled' && msgResult.value.ok) {
			messages = msgResult.value.value;
		}
		if (diffResult.status === 'fulfilled' && diffResult.value.ok) {
			diffContent = String(diffResult.value.value);
		}
		isLoading = false;
	}

	async function handleAbort() {
		await abortSession(sessionId);
	}

	async function handleFork() {
		const result = await forkSession(sessionId);
		if (result.ok) {
			window.location.reload();
		}
	}

	async function handleDelete() {
		const result = await deleteSession(sessionId);
		if (result.ok) {
			onClose();
		}
	}
</script>

<!-- Panel overlay -->
<aside
	class="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl"
	aria-label="Session Detail"
>
	<!-- Panel header -->
	<div class="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
		<div class="flex-1 min-w-0">
			<h2 class="truncate text-lg font-semibold text-[var(--color-text)]">
				{$selectedSession?.title ?? 'Session Detail'}
			</h2>
			{#if $selectedSession}
				<p class="text-xs text-[var(--color-text-muted)]">
					Updated {formatRelativeTime($selectedSession.lastUpdate)}
				</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={handleAbort}
				class="rounded-lg px-3 py-1.5 text-xs text-[var(--color-warning)] hover:bg-amber-500/10"
				aria-label="Abort session"
			>
				Abort
			</button>
			<button
				onclick={handleFork}
				class="rounded-lg px-3 py-1.5 text-xs text-[var(--color-info)] hover:bg-blue-500/10"
				aria-label="Fork session"
			>
				Fork
			</button>
			<button
				onclick={handleDelete}
				class="rounded-lg px-3 py-1.5 text-xs text-[var(--color-error)] hover:bg-red-500/10"
				aria-label="Delete session"
			>
				Delete
			</button>
			<button
				onclick={onClose}
				class="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]"
				aria-label="Close panel"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Tabs -->
	<div class="flex border-b border-[var(--color-border)]" role="tablist">
		{#each tabs as tab (tab.id)}
			<button
				onclick={() => (activeTab = tab.id)}
				class="flex-1 px-4 py-3 text-sm transition-colors {activeTab === tab.id
					? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
					: 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
				role="tab"
				aria-selected={activeTab === tab.id}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto p-6" role="tabpanel">
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent"></div>
			</div>
		{:else if activeTab === 'chat'}
			<div class="flex flex-col gap-4">
				{#if messages.length === 0}
					<p class="text-center text-sm text-[var(--color-text-muted)]">No messages yet</p>
				{:else}
					{#each messages as message (JSON.stringify(message))}
						<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
							<p class="text-sm text-[var(--color-text)]">{JSON.stringify(message)}</p>
						</div>
					{/each}
				{/if}
			</div>
		{:else if activeTab === 'diff'}
			<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
				{#if diffContent}
					<pre class="whitespace-pre-wrap text-xs text-[var(--color-text)] font-mono">{diffContent}</pre>
				{:else}
					<p class="text-center text-sm text-[var(--color-text-muted)]">No changes yet</p>
				{/if}
			</div>
		{:else if activeTab === 'cost'}
			<div class="flex flex-col gap-2">
				<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
					<p class="text-sm text-[var(--color-text-muted)]">Cost tracking will be populated from message data</p>
					{#if $selectedSession}
						<p class="mt-2 text-lg font-semibold text-[var(--color-accent)]">{formatCost($selectedSession.totalCost)}</p>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'tools'}
			<div class="flex flex-col gap-2">
				<p class="text-center text-sm text-[var(--color-text-muted)]">Tool calls will be listed here</p>
			</div>
		{/if}
	</div>
</aside>
