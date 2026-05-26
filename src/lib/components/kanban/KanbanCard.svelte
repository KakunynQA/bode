<script lang="ts">
	import type { KanbanCard } from '$lib/types';
	import { formatCost, formatRelativeTime } from '$lib/utils/format';
	import StatusBadge from './StatusBadge.svelte';

	let {
		card,
		onClick,
	}: {
		card: KanbanCard;
		onClick: () => void;
	} = $props();

	const priorityColors: Record<string, string> = {
		high: 'border-l-[var(--color-error)]',
		medium: 'border-l-[var(--color-warning)]',
		low: 'border-l-[var(--color-info)]',
	};

	let borderClass = $derived(card.priority ? priorityColors[card.priority] ?? '' : '');
</script>

<button
	onclick={onClick}
	class="group w-full cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-left transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] border-l-2 {borderClass}"
	aria-label="Session: {card.title}"
>
	<!-- Title -->
	<h3 class="mb-2 text-sm font-medium text-[var(--color-text)] line-clamp-2">
		{card.title}
	</h3>

	<!-- Meta row -->
	<div class="flex items-center justify-between gap-2">
		<StatusBadge status={card.status} />
		<span class="text-xs text-[var(--color-text-muted)]">
			{formatRelativeTime(card.lastUpdate)}
		</span>
	</div>

	<!-- Footer -->
	<div class="mt-2 flex items-center justify-between">
		{#if card.model}
			<span class="truncate text-xs text-[var(--color-text-muted)]">{card.model}</span>
		{:else}
			<span></span>
		{/if}
		{#if card.totalCost > 0}
			<span class="text-xs font-medium text-[var(--color-accent)]">{formatCost(card.totalCost)}</span>
		{/if}
	</div>

	<!-- Tags -->
	{#if card.tags.length > 0}
		<div class="mt-2 flex flex-wrap gap-1">
			{#each card.tags.slice(0, 3) as tag (tag)}
				<span class="rounded-md bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]">{tag}</span>
			{/each}
		</div>
	{/if}
</button>
