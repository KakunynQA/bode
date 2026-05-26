<script lang="ts">
	import KanbanBoard from '$lib/components/kanban/KanbanBoard.svelte';
	import CreateTaskModal from '$lib/components/CreateTaskModal.svelte';
	import SessionDetailPanel from '$lib/components/session/SessionDetailPanel.svelte';
	import { selectedSessionId, sessions } from '$lib/stores/sessions';
	import { listSessions, getSessionStatus } from '$lib/opencode/client';
	import { onMount } from 'svelte';
	import type { KanbanCard, SessionStatus } from '$lib/types';

	let isCreateModalOpen = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(() => {
		loadSessions();
	});

	async function loadSessions() {
		isLoading = true;
		error = null;

		const [sessionsResult, statusResult] = await Promise.allSettled([
			listSessions(),
			getSessionStatus(),
		]);

		const sessionsData = sessionsResult.status === 'fulfilled' && sessionsResult.value.ok
			? sessionsResult.value.value
			: [];

		const statusData = statusResult.status === 'fulfilled' && statusResult.value.ok
			? statusResult.value.value
			: {};

		const cards: KanbanCard[] = (sessionsData as Array<Record<string, unknown>>).map((s) => {
			const id = String(s['id'] ?? '');
			const statusEntry = (statusData as Record<string, { kind: string }>)[id];
			const statusKind = statusEntry?.kind ?? 'idle';

			let status: SessionStatus;
			switch (statusKind) {
				case 'running':
					status = { kind: 'running', startedAt: Date.now() };
					break;
				case 'error':
					status = { kind: 'error', reason: 'Unknown error' };
					break;
				case 'waiting-permission':
					status = { kind: 'waiting-permission' };
					break;
				default:
					status = { kind: 'idle' };
			}

			return {
				sessionId: id,
				title: String(s['title'] ?? 'Untitled'),
				model: null,
				taskType: null,
				priority: null,
				totalCost: 0,
				lastUpdate: Number(s['updatedAt'] ?? s['createdAt'] ?? Date.now()),
				status,
				kanbanColumn: 'backlog' as const,
				tags: [],
			};
		});

		sessions.set(cards);
		isLoading = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'n' && !event.ctrlKey && !event.metaKey) {
			const target = event.target as HTMLElement;
			if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
				event.preventDefault();
				isCreateModalOpen = true;
			}
		}
		if (event.key === 'Escape') {
			if ($selectedSessionId) {
				selectedSessionId.set(null);
			} else if (isCreateModalOpen) {
				isCreateModalOpen = false;
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col">
	<!-- Header -->
	<header class="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
		<div class="flex items-center gap-3">
			<h1 class="text-xl font-bold text-[var(--color-text)]">Board</h1>
			<span class="text-sm text-[var(--color-text-muted)]">
				Press <kbd class="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs font-mono">N</kbd> to create
			</span>
		</div>
		<button
			onclick={() => (isCreateModalOpen = true)}
			class="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
			aria-label="New Task"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			New Task
		</button>
	</header>

	<!-- Content -->
	{#if isLoading}
		<div class="flex flex-1 items-center justify-center">
			<div class="flex flex-col items-center gap-3">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent"></div>
				<p class="text-sm text-[var(--color-text-muted)]">Loading sessions...</p>
			</div>
		</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center">
			<div class="flex flex-col items-center gap-3 text-center">
				<p class="text-sm text-[var(--color-error)]">{error}</p>
				<button
					onclick={loadSessions}
					class="rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
				>
					Retry
				</button>
			</div>
		</div>
	{:else}
		<KanbanBoard />
	{/if}
</div>

<!-- Modals and panels -->
{#if isCreateModalOpen}
	<CreateTaskModal onClose={() => (isCreateModalOpen = false)} onCreated={loadSessions} />
{/if}

{#if $selectedSessionId}
	<SessionDetailPanel sessionId={$selectedSessionId} onClose={() => selectedSessionId.set(null)} />
{/if}
