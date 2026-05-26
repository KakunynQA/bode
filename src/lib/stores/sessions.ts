import { writable, derived } from 'svelte/store';
import type { KanbanCard, KanbanColumn, SessionMetadata } from '$lib/types';

export const sessions = writable<KanbanCard[]>([]);
export const sessionMetadata = writable<Map<string, SessionMetadata>>(new Map());
export const selectedSessionId = writable<string | null>(null);

export const sessionsByColumn = derived(sessions, ($sessions) => {
  const columns: Record<KanbanColumn, KanbanCard[]> = {
    'backlog': [],
    'in-progress': [],
    'review': [],
    'done': [],
  };

  for (const session of $sessions) {
    const col = columns[session.kanbanColumn];
    if (col) {
      col.push(session);
    }
  }

  return columns;
});

export const selectedSession = derived(
  [sessions, selectedSessionId],
  ([$sessions, $selectedId]) => {
    if (!$selectedId) return null;
    return $sessions.find((s) => s.sessionId === $selectedId) ?? null;
  }
);

export const totalCost = derived(sessions, ($sessions) =>
  $sessions.reduce((sum, s) => sum + s.totalCost, 0)
);
