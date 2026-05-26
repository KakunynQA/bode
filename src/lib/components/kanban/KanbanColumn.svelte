<script lang="ts">
	import KanbanCardComponent from './KanbanCard.svelte';
	import type { KanbanCard, KanbanColumn } from '$lib/types';

	let {
		id,
		label,
		cards,
		onCardClick,
	}: {
		id: KanbanColumn;
		label: string;
		cards: KanbanCard[];
		onCardClick: (sessionId: string) => void;
	} = $props();

	const columnColors: Record<KanbanColumn, string> = {
		'backlog': 'border-[var(--color-text-muted)]',
		'in-progress': 'border-[var(--color-info)]',
		'review': 'border-[var(--color-warning)]',
		'done': 'border-[var(--color-success)]',
	};
</script>

<section
	class="flex h-full w-72 min-w-[18rem] flex-col rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
	aria-label={label}
>
	<div class="flex items-center gap-2 border-b-2 {columnColors[id]} px-4 py-3">
		<h2 class="text-sm font-semibold text-[var(--color-text)]">{label}</h2>
		<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
			{cards.length}
		</span>
	</div>

	<div class="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
		{#if cards.length === 0}
			<div class="flex flex-1 items-center justify-center">
				<p class="text-xs text-[var(--color-text-muted)]">No tasks</p>
			</div>
		{:else}
			{#each cards as card (card.sessionId)}
				<KanbanCardComponent {card} onClick={() => onCardClick(card.sessionId)} />
			{/each}
		{/if}
	</div>
</section>
