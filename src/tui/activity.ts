export type ActivityEntry =
	| { kind: 'user-task'; text: string; timestamp?: number }
	| { kind: 'phase-start'; phase: string; taskKey?: string }
	| { kind: 'phase-complete'; phase: string; taskKey?: string }
	| { kind: 'command-output'; text: string }
	| { kind: 'artifact'; label: string; path: string }
	| { kind: 'info'; text: string }
	| { kind: 'warning'; text: string }
	| { kind: 'error'; text: string; exitCode?: number }
	| { kind: 'success'; text: string; exitCode?: number };

export type ActivityState = {
	entries: ActivityEntry[];
};

export function createActivityState(): ActivityState {
	return { entries: [] };
}

export function pushActivity(state: ActivityState, entry: ActivityEntry): ActivityState {
	return { entries: [...state.entries, entry] };
}

export function activityIsEmpty(state: ActivityState): boolean {
	return state.entries.length === 0;
}

export function lastEntry(state: ActivityState): ActivityEntry | null {
	return state.entries[state.entries.length - 1] ?? null;
}

export function appendToLastOutput(state: ActivityState, text: string): ActivityState {
	const last = state.entries[state.entries.length - 1];
	if (!last) return state;
	if (last.kind !== 'command-output') return state;
	const entries = [...state.entries];
	entries[entries.length - 1] = { ...last, text: last.text + text };
	return { entries };
}
