export type TimelineEntry =
	| { kind: 'user'; text: string }
	| { kind: 'info'; text: string }
	| { kind: 'stdout'; text: string }
	| { kind: 'stderr'; text: string }
	| { kind: 'error'; text: string }
	| { kind: 'success'; text: string; exitCode: number };

export type TimelineState = {
	entries: TimelineEntry[];
};

export function createTimelineState(): TimelineState {
	return { entries: [] };
}

export function pushEntry(state: TimelineState, entry: TimelineEntry): TimelineState {
	return { entries: [...state.entries, entry] };
}

export function appendToLastOutput(state: TimelineState, text: string): TimelineState {
	if (state.entries.length === 0) return state;
	const last = state.entries[state.entries.length - 1];
	if (!last) return state;
	if (last.kind !== 'stdout' && last.kind !== 'stderr') return state;
	const entries = [...state.entries];
	entries[entries.length - 1] = { ...last, text: last.text + text };
	return { entries };
}

export function timelineIsEmpty(state: TimelineState): boolean {
	return state.entries.length === 0;
}
