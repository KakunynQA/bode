<script lang="ts">
	import KanbanColumn from './KanbanColumn.svelte';
	import { sessionsByColumn, selectedSessionId } from '$lib/stores/sessions';
	import type { KanbanColumn as KanbanColumnType } from '$lib/types';

	const columns: { id: KanbanColumnType; label: string }[] = [
		{ id: 'backlog', label: 'Backlog' },
		{ id: 'in-progress', label: 'In Progress' },
		{ id: 'review', label: 'Review' },
		{ id: 'done', label: 'Done' },
	];

	function handleCardClick(sessionId: string) {
		selectedSessionId.set(sessionId);
	}
</script>

<div class="flex h-full gap-4 overflow-x-auto p-6" role="region" aria-label="Kanban Board">
	{#each columns as column (column.id)}
		<KanbanColumn
			id={column.id}
			label={column.label}
			cards={$sessionsByColumn[column.id]}
			onCardClick={handleCardClick}
		/>
	{/each}
</div>
