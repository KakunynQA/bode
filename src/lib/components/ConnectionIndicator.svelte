<script lang="ts">
	import { connectionStatus } from '$lib/stores/connection';

	const statusConfig = {
		connected: { label: 'Connected', color: 'bg-[var(--color-success)]' },
		connecting: { label: 'Connecting...', color: 'bg-[var(--color-warning)]' },
		disconnected: { label: 'Disconnected', color: 'bg-[var(--color-text-muted)]' },
		error: { label: 'Connection Error', color: 'bg-[var(--color-error)]' },
	} as const;

	let isExpanded = $state(false);

	let statusInfo = $derived(statusConfig[$connectionStatus]);
</script>

<div class="fixed bottom-4 right-4 z-50">
	<button
		onclick={() => (isExpanded = !isExpanded)}
		class="flex items-center gap-2 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-1.5 text-xs shadow-lg transition-all hover:border-[var(--color-border-hover)]"
		aria-label="Connection status: {statusInfo.label}"
	>
		<span class="relative flex h-2 w-2">
			{#if $connectionStatus === 'connecting'}
				<span class="absolute inline-flex h-full w-full animate-ping rounded-full {statusInfo.color} opacity-75"></span>
			{/if}
			<span class="relative inline-flex h-2 w-2 rounded-full {statusInfo.color}"></span>
		</span>
		{#if isExpanded}
			<span class="text-[var(--color-text-secondary)]">{statusInfo.label}</span>
		{/if}
	</button>
</div>
