export type PaletteCommand = {
	id: string;
	label: string;
	shortcut?: string;
	category: string;
};

export type PaletteState = {
	open: boolean;
	query: string;
	items: PaletteCommand[];
	filtered: PaletteCommand[];
	cursor: number;
	categories: string[];
};

export const PALETTE_COMMANDS: PaletteCommand[] = [
	{ id: 'new-task', label: 'New task/run', shortcut: 'ctrl+x n', category: 'Suggested' },
	{ id: 'view-status', label: 'View status', shortcut: 'ctrl+x s', category: 'Suggested' },
	{ id: 'clear-prompt', label: 'Clear prompt', category: 'Prompt' },
	{ id: 'open-help', label: 'Open help', category: 'Prompt' },
	{ id: 'view-project', label: 'View project information', category: 'System' },
	{ id: 'view-version', label: 'View version', category: 'System' },
	{ id: 'exit', label: 'Exit', shortcut: 'ctrl+x q', category: 'System' },
];

function filterItems(items: PaletteCommand[], query: string): PaletteCommand[] {
	if (!query) return items;
	const lower = query.toLowerCase();
	return items.filter(
		(item) =>
			item.label.toLowerCase().includes(lower) ||
			item.category.toLowerCase().includes(lower) ||
			(item.shortcut?.toLowerCase().includes(lower) ?? false)
	);
}

function uniqueCategories(items: PaletteCommand[]): string[] {
	const seen = new Set<string>();
	for (const item of items) {
		if (!seen.has(item.category)) seen.add(item.category);
	}
	return [...seen];
}

export function createPaletteState(items?: PaletteCommand[]): PaletteState {
	const all = items ?? PALETTE_COMMANDS;
	return {
		open: false,
		query: '',
		items: all,
		filtered: all,
		cursor: 0,
		categories: uniqueCategories(all),
	};
}

export type PaletteAction =
	| { kind: 'open' }
	| { kind: 'close' }
	| { kind: 'type'; value: string }
	| { kind: 'up' }
	| { kind: 'down' }
	| { kind: 'select' }
	| { kind: 'reset' };

export function reducePalette(state: PaletteState, action: PaletteAction): PaletteState {
	switch (action.kind) {
		case 'open':
			return { ...state, open: true, query: '', cursor: 0, filtered: state.items };
		case 'close':
			return { ...state, open: false, query: '' };
		case 'type': {
			const filtered = filterItems(state.items, action.value);
			return {
				...state,
				query: action.value,
				filtered,
				cursor: 0,
				categories: uniqueCategories(filtered),
			};
		}
		case 'up':
			return { ...state, cursor: Math.max(0, state.cursor - 1) };
		case 'down':
			return { ...state, cursor: Math.min(state.filtered.length - 1, state.cursor + 1) };
		case 'select':
			return state;
		case 'reset':
			return createPaletteState(state.items);
		default:
			return state;
	}
}

export function selectedCommand(state: PaletteState): PaletteCommand | null {
	if (state.filtered.length === 0) return null;
	return state.filtered[state.cursor] ?? null;
}
