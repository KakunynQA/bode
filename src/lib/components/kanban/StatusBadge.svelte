<script lang="ts">
	import type { SessionStatus } from '$lib/types';

	let { status }: { status: SessionStatus } = $props();

	const statusStyles = {
		idle: { label: 'Idle', bg: 'bg-[var(--color-bg-tertiary)]', text: 'text-[var(--color-text-muted)]', dot: 'bg-[var(--color-text-muted)]' },
		running: { label: 'Running', bg: 'bg-emerald-500/10', text: 'text-[var(--color-success)]', dot: 'bg-[var(--color-success)]' },
		'waiting-permission': { label: 'Waiting', bg: 'bg-amber-500/10', text: 'text-[var(--color-warning)]', dot: 'bg-[var(--color-warning)]' },
		error: { label: 'Error', bg: 'bg-red-500/10', text: 'text-[var(--color-error)]', dot: 'bg-[var(--color-error)]' },
	} as const;

	let style = $derived(statusStyles[status.kind]);
</script>

<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs {style.bg} {style.text}">
	<span class="relative flex h-1.5 w-1.5">
		{#if status.kind === 'running'}
			<span class="absolute inline-flex h-full w-full animate-ping rounded-full {style.dot} opacity-75"></span>
		{/if}
		<span class="relative inline-flex h-1.5 w-1.5 rounded-full {style.dot}"></span>
	</span>
	{style.label}
</span>
