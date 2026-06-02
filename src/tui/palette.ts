export type PaletteCommand = {
	id: string;
	label: string;
	shortcut?: string;
	category: string;
	insertText: string;
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
	{ id: 'cmd-setup', label: 'Setup bode', category: 'Setup', insertText: 'setup' },
	{
		id: 'cmd-setup-project',
		label: 'Setup project config',
		category: 'Setup',
		insertText: 'setup-project ',
	},
	{
		id: 'cmd-setup-transitions',
		label: 'Setup tracker transitions',
		category: 'Setup',
		shortcut: '--project',
		insertText: 'setup-transitions ',
	},
	{
		id: 'cmd-init',
		label: 'Scaffold AGENTS.md',
		category: 'Setup',
		insertText: 'init',
	},
	{
		id: 'cmd-learn',
		label: 'Generate project context',
		category: 'Setup',
		insertText: 'learn',
	},
	{ id: 'cmd-start', label: 'Start a task', category: 'Run', insertText: 'start ' },
	{
		id: 'cmd-continue',
		label: 'Continue task to next phase',
		category: 'Run',
		insertText: 'continue ',
	},
	{ id: 'cmd-done', label: 'Mark task done', category: 'Run', insertText: 'done ' },
	{ id: 'cmd-abort', label: 'Abort task', category: 'Run', insertText: 'abort ' },
	{ id: 'cmd-new', label: 'Create local task', category: 'Run', insertText: 'new ' },
	{ id: 'cmd-cancel', label: 'Cancel scheduled task', category: 'Run', insertText: 'cancel ' },
	{ id: 'cmd-status', label: 'View task status', category: 'Inspect', insertText: 'status ' },
	{
		id: 'cmd-list',
		label: 'List tracked tasks',
		category: 'Inspect',
		shortcut: 'ctrl+x l',
		insertText: 'list',
	},
	{ id: 'cmd-log', label: 'Show task log', category: 'Inspect', insertText: 'log ' },
	{
		id: 'cmd-doctor',
		label: 'Diagnose environment',
		category: 'Inspect',
		shortcut: 'ctrl+x s',
		insertText: 'doctor',
	},
	{ id: 'cmd-skills', label: 'Manage skills', category: 'Inspect', insertText: 'skills' },
	{
		id: 'cmd-clear',
		label: 'Clear screen',
		category: 'Built-ins',
		insertText: 'clear',
	},
	{
		id: 'cmd-help',
		label: 'Show help',
		category: 'Built-ins',
		shortcut: 'ctrl+x h',
		insertText: 'help',
	},
	{
		id: 'cmd-exit',
		label: 'Exit bode',
		category: 'Built-ins',
		shortcut: 'ctrl+x q',
		insertText: 'exit',
	},
];

function filterItems(items: PaletteCommand[], query: string): PaletteCommand[] {
	if (!query) return items;
	const lower = query.toLowerCase();
	return items.filter(
		(item) =>
			item.label.toLowerCase().includes(lower) ||
			item.category.toLowerCase().includes(lower) ||
			item.insertText.toLowerCase().includes(lower) ||
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
