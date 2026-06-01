import pc from 'picocolors';

// ---------------------------------------------------------------------------
// Public API — sentinels, error classes, types
// ---------------------------------------------------------------------------

export const AT_TRIGGER = Symbol('__AT_TRIGGER__');

export class CancelledError extends Error {
	constructor() {
		super('__CANCELLED__');
		this.name = 'CancelledError';
	}
}

export class TerminateShellError extends Error {
	constructor() {
		super('__TERMINATE_SHELL__');
		this.name = 'TerminateShellError';
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function reRefStdin(): void {
	try {
		(process.stdin as unknown as { ref?: () => void }).ref?.();
	} catch {
		/* ignore */
	}
}

export function handlePromptError(err: unknown, cleanup?: () => void): void {
	cleanup?.();
	if (err instanceof TerminateShellError) {
		console.log(pc.dim('\nExited.\n'));
		throw err;
	}
	if (err instanceof CancelledError) {
		console.log(pc.dim('\nCancelled.\n'));
		throw err;
	}
	throw err;
}

// ---------------------------------------------------------------------------
// Keypress parser — shared across all prompts
// ---------------------------------------------------------------------------

type KeyKind =
	| 'char'
	| 'enter'
	| 'backspace'
	| 'delete'
	| 'left'
	| 'right'
	| 'up'
	| 'down'
	| 'home'
	| 'end'
	| 'ctrlC'
	| 'at';

export type KeyEvent = { kind: Exclude<KeyKind, 'char'> } | { kind: 'char'; value: string };

export function parseChunk(chunk: string): KeyEvent[] {
	const out: KeyEvent[] = [];
	let i = 0;
	while (i < chunk.length) {
		const c = chunk[i]!;
		if (c === '\x1b') {
			if (i + 1 < chunk.length && chunk[i + 1] === '[') {
				let j = i + 2;
				while (j < chunk.length && (chunk[j]! < '@' || chunk[j]! > '~')) j++;
				const seq = chunk.slice(i, j + 1);
				const evt = csiEvent(seq);
				if (evt) out.push(evt);
				i = j + 1;
				continue;
			}
			// Lone ESC and unrecognized escape sequences are swallowed (no back-nav).
			i++;
			continue;
		}
		if (c === '\r' || c === '\n') {
			out.push({ kind: 'enter' });
			i++;
			continue;
		}
		if (c === '\x7f' || c === '\x08') {
			out.push({ kind: 'backspace' });
			i++;
			continue;
		}
		if (c === '\x03') {
			out.push({ kind: 'ctrlC' });
			i++;
			continue;
		}
		if (c === '@') {
			out.push({ kind: 'at' });
			i++;
			continue;
		}
		if (c < ' ') {
			i++;
			continue;
		}
		out.push({ kind: 'char', value: c });
		i++;
	}
	return out;
}

function csiEvent(seq: string): KeyEvent | null {
	switch (seq) {
		case '\x1b[A':
			return { kind: 'up' };
		case '\x1b[B':
			return { kind: 'down' };
		case '\x1b[C':
			return { kind: 'right' };
		case '\x1b[D':
			return { kind: 'left' };
		case '\x1b[H':
		case '\x1b[1~':
		case '\x1b[7~':
			return { kind: 'home' };
		case '\x1b[F':
		case '\x1b[4~':
		case '\x1b[8~':
			return { kind: 'end' };
		case '\x1b[3~':
			return { kind: 'delete' };
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Reducers — pure state machines for each prompt type
// ---------------------------------------------------------------------------

export type PromptExit = 'AT_TRIGGER' | 'DONE' | 'CANCELLED';

export type PromptState = {
	buffer: string;
	cursor: number;
	exit?: PromptExit;
};

export function reduceKeystroke(state: PromptState, key: KeyEvent): PromptState {
	if (state.exit) return state;
	switch (key.kind) {
		case 'at':
			return { ...state, exit: 'AT_TRIGGER' };
		case 'enter':
			return { ...state, exit: 'DONE' };
		case 'ctrlC':
			return { ...state, exit: 'CANCELLED' };
		case 'up':
		case 'down':
			return state;
		case 'char': {
			const before = state.buffer.slice(0, state.cursor);
			const after = state.buffer.slice(state.cursor);
			return { buffer: before + key.value + after, cursor: state.cursor + key.value.length };
		}
		case 'backspace': {
			if (state.cursor === 0) return state;
			const before = state.buffer.slice(0, state.cursor - 1);
			const after = state.buffer.slice(state.cursor);
			return { buffer: before + after, cursor: state.cursor - 1 };
		}
		case 'delete': {
			if (state.cursor >= state.buffer.length) return state;
			const before = state.buffer.slice(0, state.cursor);
			const after = state.buffer.slice(state.cursor + 1);
			return { buffer: before + after, cursor: state.cursor };
		}
		case 'left':
			return state.cursor === 0 ? state : { ...state, cursor: state.cursor - 1 };
		case 'right':
			return state.cursor >= state.buffer.length ? state : { ...state, cursor: state.cursor + 1 };
		case 'home':
			return state.cursor === 0 ? state : { ...state, cursor: 0 };
		case 'end':
			return state.cursor >= state.buffer.length
				? state
				: { ...state, cursor: state.buffer.length };
	}
}

export type InputPromptState = {
	buffer: string;
	cursor: number;
	exit?: 'DONE' | 'CANCELLED' | undefined;
	validateError?: string | undefined;
};

export function reduceInputState(state: InputPromptState, key: KeyEvent): InputPromptState {
	if (state.exit) return state;
	switch (key.kind) {
		case 'enter': {
			return { ...state, exit: 'DONE', validateError: undefined };
		}
		case 'ctrlC':
			return { ...state, exit: 'CANCELLED' };
		case 'at': {
			const before = state.buffer.slice(0, state.cursor);
			const after = state.buffer.slice(state.cursor);
			return {
				buffer: before + '@' + after,
				cursor: state.cursor + 1,
				validateError: undefined,
			};
		}
		case 'up':
		case 'down':
			return state;
		case 'char': {
			const before = state.buffer.slice(0, state.cursor);
			const after = state.buffer.slice(state.cursor);
			return {
				buffer: before + key.value + after,
				cursor: state.cursor + key.value.length,
				validateError: undefined,
			};
		}
		case 'backspace': {
			if (state.cursor === 0) return { ...state, validateError: undefined };
			const before = state.buffer.slice(0, state.cursor - 1);
			const after = state.buffer.slice(state.cursor);
			return { buffer: before + after, cursor: state.cursor - 1, validateError: undefined };
		}
		case 'delete': {
			if (state.cursor >= state.buffer.length) return { ...state, validateError: undefined };
			const before = state.buffer.slice(0, state.cursor);
			const after = state.buffer.slice(state.cursor + 1);
			return { buffer: before + after, cursor: state.cursor, validateError: undefined };
		}
		case 'left':
			return state.cursor === 0
				? state
				: { ...state, cursor: state.cursor - 1, validateError: undefined };
		case 'right':
			return state.cursor >= state.buffer.length
				? state
				: { ...state, cursor: state.cursor + 1, validateError: undefined };
		case 'home':
			return state.cursor === 0 ? state : { ...state, cursor: 0, validateError: undefined };
		case 'end':
			return state.cursor >= state.buffer.length
				? state
				: { ...state, cursor: state.buffer.length, validateError: undefined };
	}
}

// ---------------------------------------------------------------------------
// Select reducer
// ---------------------------------------------------------------------------

export type SelectChoice<T> = {
	name: string;
	value: T;
	description?: string;
	disabled?: boolean;
};

export type SelectPromptState<T> = {
	items: SelectChoice<T>[];
	cursor: number;
	scrollOffset: number;
	pageSize: number;
	exit?: 'DONE' | 'CANCELLED' | undefined;
};

function clampCursor<T>(state: SelectPromptState<T>): SelectPromptState<T> {
	if (state.items.length === 0) return { ...state, cursor: 0 };
	let cursor = Math.max(0, Math.min(state.cursor, state.items.length - 1));
	while (cursor < state.items.length && state.items[cursor]?.disabled) cursor++;
	if (cursor >= state.items.length) {
		cursor = state.items.length - 1;
		while (cursor >= 0 && state.items[cursor]?.disabled) cursor--;
	}
	if (cursor < 0) cursor = 0;
	return { ...state, cursor };
}

export function reduceSelectState<T>(
	state: SelectPromptState<T>,
	key: KeyEvent
): SelectPromptState<T> {
	if (state.exit) return state;
	switch (key.kind) {
		case 'up': {
			let cursor = state.cursor - 1;
			while (cursor >= 0 && state.items[cursor]?.disabled) cursor--;
			if (cursor < 0) return state;
			const scrollOffset = cursor < state.scrollOffset ? cursor : state.scrollOffset;
			return { ...state, cursor, scrollOffset };
		}
		case 'down': {
			let cursor = state.cursor + 1;
			while (cursor < state.items.length && state.items[cursor]?.disabled) cursor++;
			if (cursor >= state.items.length) return state;
			const pageSize = state.pageSize;
			const scrollOffset =
				cursor >= state.scrollOffset + pageSize ? cursor - pageSize + 1 : state.scrollOffset;
			return { ...state, cursor, scrollOffset };
		}
		case 'enter':
			if (
				state.items.length === 0 ||
				state.cursor >= state.items.length ||
				state.items[state.cursor]?.disabled
			)
				return state;
			return { ...state, exit: 'DONE' };
		case 'ctrlC':
			return { ...state, exit: 'CANCELLED' };
		default:
			return state;
	}
}

// ---------------------------------------------------------------------------
// Search reducer
// ---------------------------------------------------------------------------

export type SearchChoice<T> = {
	name: string;
	value: T;
	description?: string;
};

export type SearchPromptState<T> = {
	buffer: string;
	inputCursor: number;
	items: SearchChoice<T>[];
	listCursor: number;
	scrollOffset: number;
	pageSize: number;
	loading: boolean;
	focusMode: 'input' | 'list';
	exit?: 'DONE' | 'CANCELLED' | undefined;
};

export function reduceSearchState<T>(
	state: SearchPromptState<T>,
	key: KeyEvent
): SearchPromptState<T> {
	if (state.exit) return state;
	switch (key.kind) {
		case 'up': {
			if (state.items.length === 0) return state;
			const newFocus: 'input' | 'list' = 'list';
			let listCursor = state.focusMode === 'input' ? 0 : state.listCursor - 1;
			if (listCursor < 0) listCursor = 0;
			const scrollOffset = listCursor < state.scrollOffset ? listCursor : state.scrollOffset;
			return { ...state, focusMode: newFocus, listCursor, scrollOffset };
		}
		case 'down': {
			if (state.items.length === 0) return state;
			const newFocus: 'input' | 'list' = 'list';
			let listCursor = state.focusMode === 'input' ? 0 : state.listCursor + 1;
			if (listCursor >= state.items.length) listCursor = state.items.length - 1;
			const pageSize = state.pageSize;
			const scrollOffset =
				listCursor >= state.scrollOffset + pageSize
					? listCursor - pageSize + 1
					: state.scrollOffset;
			return { ...state, focusMode: newFocus, listCursor, scrollOffset };
		}
		case 'enter': {
			if (state.focusMode === 'input') {
				if (state.items.length === 0) return { ...state, exit: 'DONE' };
				return { ...state, focusMode: 'list', listCursor: 0, exit: 'DONE' };
			}
			if (state.listCursor >= state.items.length) return state;
			return { ...state, exit: 'DONE' };
		}
		case 'ctrlC':
			return { ...state, exit: 'CANCELLED' };
		case 'char': {
			const before = state.buffer.slice(0, state.inputCursor);
			const after = state.buffer.slice(state.inputCursor);
			return {
				...state,
				buffer: before + key.value + after,
				inputCursor: state.inputCursor + key.value.length,
				focusMode: 'input',
				loading: true,
			};
		}
		case 'backspace': {
			if (state.inputCursor === 0) return { ...state, focusMode: 'input' };
			const before = state.buffer.slice(0, state.inputCursor - 1);
			const after = state.buffer.slice(state.inputCursor);
			return {
				...state,
				buffer: before + after,
				inputCursor: state.inputCursor - 1,
				focusMode: 'input',
				loading: true,
			};
		}
		case 'delete': {
			if (state.inputCursor >= state.buffer.length) return { ...state, focusMode: 'input' };
			const before = state.buffer.slice(0, state.inputCursor);
			const after = state.buffer.slice(state.inputCursor + 1);
			return {
				...state,
				buffer: before + after,
				focusMode: 'input',
				loading: true,
			};
		}
		case 'left':
			return {
				...state,
				inputCursor: Math.max(0, state.inputCursor - 1),
				focusMode: 'input',
			};
		case 'right':
			return {
				...state,
				inputCursor: Math.min(state.buffer.length, state.inputCursor + 1),
				focusMode: 'input',
			};
		case 'home':
			return { ...state, inputCursor: 0, focusMode: 'input' };
		case 'end':
			return { ...state, inputCursor: state.buffer.length, focusMode: 'input' };
		case 'at': {
			const before = state.buffer.slice(0, state.inputCursor);
			const after = state.buffer.slice(state.inputCursor);
			return {
				...state,
				buffer: before + '@' + after,
				inputCursor: state.inputCursor + 1,
				focusMode: 'input',
				loading: true,
			};
		}
	}
}

// ---------------------------------------------------------------------------
// Raw-mode stdin ownership helpers
// ---------------------------------------------------------------------------

type RawModeSession = {
	restore: () => void;
};

function acquireStdin(): RawModeSession {
	const stdin = process.stdin;
	const wasRaw = stdin.isRaw === true;
	const hadEncoding = stdin.readableEncoding;
	if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding('utf8');
	return {
		restore() {
			if (typeof stdin.setRawMode === 'function' && !wasRaw) {
				try {
					stdin.setRawMode(false);
				} catch {
					/* ignore */
				}
			}
			if (hadEncoding === null) {
				try {
					stdin.setEncoding(null as unknown as BufferEncoding);
				} catch {
					/* ignore */
				}
			}
		},
	};
}

// ---------------------------------------------------------------------------
// askInput — raw-mode single-line text input
// ---------------------------------------------------------------------------

export type AskInputOpts = {
	message: string;
	default?: string | undefined;
	validate?: (value: string) => boolean | string | Promise<boolean | string>;
};

export async function askInput(opts: AskInputOpts): Promise<string> {
	reRefStdin();

	return new Promise<string>((resolve, reject) => {
		const session = acquireStdin();
		const stdin = process.stdin;
		const prefix = `? ${pc.bold(opts.message)} `;
		let state: InputPromptState = {
			buffer: opts.default ?? '',
			cursor: (opts.default ?? '').length,
		};
		let closed = false;
		let lastRenderHeight = 0;

		function render(): void {
			if (lastRenderHeight > 0) {
				if (lastRenderHeight > 1) {
					process.stdout.write(`\x1b[${lastRenderHeight - 1}A`);
				}
				process.stdout.write('\r\x1b[0J');
			}
			const lines: string[] = [];
			const trailing = state.buffer.length - state.cursor;
			let line = '\r\x1b[2K' + prefix + state.buffer;
			if (trailing > 0) line += `\x1b[${trailing}D`;
			lines.push(line);
			if (state.validateError) {
				lines.push(`\r\x1b[2K  ${pc.red(state.validateError)}`);
			}
			lastRenderHeight = lines.length;
			process.stdout.write(lines.join('\n'));
		}

		function cleanup(): void {
			if (closed) return;
			closed = true;
			stdin.removeListener('data', onData);
			session.restore();
			process.stdout.write('\n');
		}

		async function finish(exit: 'DONE' | 'CANCELLED'): Promise<void> {
			if (exit === 'DONE' && opts.validate) {
				try {
					const result = opts.validate(state.buffer);
					const validation = result instanceof Promise ? await result : result;
					if (typeof validation === 'string') {
						state = { ...state, exit: undefined, validateError: validation };
						render();
						return;
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					state = { ...state, exit: undefined, validateError: msg };
					render();
					return;
				}
			}
			cleanup();
			if (exit === 'DONE') resolve(state.buffer);
			else reject(new TerminateShellError());
		}

		function onData(chunk: Buffer | string): void {
			const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
			handleEvents(parseChunk(text));
		}

		function handleEvents(events: KeyEvent[]): void {
			if (events.length === 0) return;
			for (const evt of events) {
				state = reduceInputState(state, evt);
				if (state.exit) {
					finish(state.exit);
					return;
				}
			}
			render();
		}

		stdin.on('data', onData);
		render();
	});
}

// ---------------------------------------------------------------------------
// askSelect — raw-mode navigable list
// ---------------------------------------------------------------------------

export type AskSelectOpts<T> = {
	message: string;
	choices: SelectChoice<T>[];
	default?: T;
	pageSize?: number;
};

export async function askSelect<T>(opts: AskSelectOpts<T>): Promise<T> {
	reRefStdin();

	return new Promise<T>((resolve, reject) => {
		const session = acquireStdin();
		const stdin = process.stdin;
		const prefix = `? ${pc.bold(opts.message)}`;
		const effectivePageSize = opts.pageSize ?? 7;
		let initialCursor = 0;
		if (opts.default !== undefined) {
			const idx = opts.choices.findIndex((c) => c.value === opts.default);
			if (idx >= 0) initialCursor = idx;
		}
		let state: SelectPromptState<T> = clampCursor({
			items: opts.choices,
			cursor: initialCursor,
			scrollOffset: 0,
			pageSize: effectivePageSize,
		});
		let closed = false;
		let lastRenderHeight = 0;

		function render(): void {
			if (lastRenderHeight > 0) {
				if (lastRenderHeight > 1) {
					process.stdout.write(`\x1b[${lastRenderHeight - 1}A`);
				}
				process.stdout.write('\r\x1b[0J');
			}
			const lines: string[] = [];
			lines.push('\r\x1b[2K' + prefix);
			const visibleStart = state.scrollOffset;
			const visibleEnd = Math.min(state.items.length, visibleStart + state.pageSize);
			for (let i = visibleStart; i < visibleEnd; i++) {
				const item = state.items[i]!;
				if (item.disabled) {
					lines.push(`\r\x1b[2K  ${pc.dim('───────')}`);
					continue;
				}
				const selected = i === state.cursor;
				const indicator = selected ? pc.cyan('❯') : ' ';
				const name = selected ? pc.cyan(item.name) : item.name;
				let line = `\r\x1b[2K${indicator} ${name}`;
				if (selected && item.description) {
					line += pc.dim(` — ${item.description}`);
				}
				lines.push(line);
			}
			if (state.items.length > state.pageSize) {
				const pct = Math.round(((state.cursor + 1) / state.items.length) * 100);
				lines.push(`\r\x1b[2K${pc.dim(`  (${pct}%)`)}`);
			}
			lastRenderHeight = lines.length;
			process.stdout.write(lines.join('\n'));
		}

		function cleanup(): void {
			if (closed) return;
			closed = true;
			stdin.removeListener('data', onData);
			session.restore();
			process.stdout.write('\n');
		}

		function finish(exit: 'DONE' | 'CANCELLED'): void {
			cleanup();
			if (exit === 'DONE') resolve(state.items[state.cursor]!.value);
			else reject(new TerminateShellError());
		}

		function onData(chunk: Buffer | string): void {
			const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
			handleEvents(parseChunk(text));
		}

		function handleEvents(events: KeyEvent[]): void {
			if (events.length === 0) return;
			for (const evt of events) {
				state = reduceSelectState(state, evt);
				if (state.exit) {
					finish(state.exit);
					return;
				}
			}
			render();
		}

		stdin.on('data', onData);
		render();
	});
}

// ---------------------------------------------------------------------------
// askSearch — raw-mode input + async source + list
// ---------------------------------------------------------------------------

export type AskSearchOpts<T> = {
	message: string;
	source: (input: string, runId: symbol) => Promise<SearchChoice<T>[]>;
	pageSize?: number;
};

export async function askSearch<T>(opts: AskSearchOpts<T>): Promise<T> {
	reRefStdin();

	return new Promise<T>((resolve, reject) => {
		const session = acquireStdin();
		const stdin = process.stdin;
		const prefix = `? ${pc.bold(opts.message)} `;
		const effectivePageSize = opts.pageSize ?? 7;
		const runId = Symbol('search-run');
		let state: SearchPromptState<T> = {
			buffer: '',
			inputCursor: 0,
			items: [],
			listCursor: 0,
			scrollOffset: 0,
			pageSize: effectivePageSize,
			loading: false,
			focusMode: 'input',
		};
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		let closed = false;
		let lastRenderHeight = 0;

		function render(): void {
			if (lastRenderHeight > 0) {
				if (lastRenderHeight > 1) {
					process.stdout.write(`\x1b[${lastRenderHeight - 1}A`);
				}
				process.stdout.write('\r\x1b[0J');
			}
			const lines: string[] = [];
			const trailing = state.buffer.length - state.inputCursor;
			let inputLine = '\r\x1b[2K' + prefix + state.buffer;
			if (trailing > 0) inputLine += `\x1b[${trailing}D`;
			lines.push(inputLine);
			if (state.loading) {
				lines.push(`\r\x1b[2K  ${pc.dim('Loading...')}`);
			} else if (state.items.length === 0 && state.buffer.length > 0) {
				lines.push(`\r\x1b[2K  ${pc.dim('No results')}`);
			} else {
				const visibleStart = state.scrollOffset;
				const visibleEnd = Math.min(state.items.length, visibleStart + state.pageSize);
				for (let i = visibleStart; i < visibleEnd; i++) {
					const item = state.items[i]!;
					const selected = state.focusMode === 'list' && i === state.listCursor;
					const indicator = selected ? pc.cyan('❯') : ' ';
					const name = selected ? pc.cyan(item.name) : item.name;
					let line = `\r\x1b[2K${indicator} ${name}`;
					if (selected && item.description) {
						line += pc.dim(` — ${item.description}`);
					}
					lines.push(line);
				}
			}
			lastRenderHeight = lines.length;
			process.stdout.write(lines.join('\n'));
		}

		function cleanup(): void {
			if (closed) return;
			closed = true;
			stdin.removeListener('data', onData);
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			session.restore();
			process.stdout.write('\n');
		}

		function finish(exit: 'DONE' | 'CANCELLED'): void {
			cleanup();
			if (exit === 'CANCELLED') {
				reject(new TerminateShellError());
				return;
			}
			if (state.focusMode === 'list' && state.listCursor < state.items.length) {
				resolve(state.items[state.listCursor]!.value);
			} else if (state.items.length > 0) {
				resolve(state.items[0]!.value);
			} else {
				resolve(undefined as T);
			}
		}

		async function fetchSource(): Promise<void> {
			if (closed) return;
			try {
				const results = await opts.source(state.buffer, runId);
				if (closed) return;
				state = {
					...state,
					items: results,
					listCursor: 0,
					scrollOffset: 0,
					loading: false,
				};
				render();
			} catch {
				if (closed) return;
				state = { ...state, items: [], loading: false };
				render();
			}
		}

		function scheduleSourceFetch(): void {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				fetchSource();
			}, 300);
		}

		function onData(chunk: Buffer | string): void {
			const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
			handleEvents(parseChunk(text));
		}

		function handleEvents(events: KeyEvent[]): void {
			if (events.length === 0) return;
			const wasLoading = state.loading;
			for (const evt of events) {
				state = reduceSearchState(state, evt);
				if (state.exit) {
					finish(state.exit);
					return;
				}
			}
			if (state.loading && !wasLoading) {
				scheduleSourceFetch();
			}
			render();
		}

		stdin.on('data', onData);
		state = { ...state, loading: true };
		render();
		fetchSource();
	});
}

// ---------------------------------------------------------------------------
// askPassword — raw-mode masked input
// ---------------------------------------------------------------------------

export type AskPasswordOpts = {
	message: string;
	mask?: boolean;
	default?: string;
};

export async function askPassword(opts: AskPasswordOpts): Promise<string> {
	reRefStdin();

	return new Promise<string>((resolve, reject) => {
		const session = acquireStdin();
		const stdin = process.stdin;
		const prefix = `? ${pc.bold(opts.message)} `;
		const showMask = opts.mask ?? true;
		let state: InputPromptState = {
			buffer: opts.default ?? '',
			cursor: (opts.default ?? '').length,
		};
		let closed = false;
		let lastRenderHeight = 0;

		function render(): void {
			if (lastRenderHeight > 0) {
				if (lastRenderHeight > 1) {
					process.stdout.write(`\x1b[${lastRenderHeight - 1}A`);
				}
				process.stdout.write('\r\x1b[0J');
			}
			const lines: string[] = [];
			const display = showMask ? '*'.repeat(state.buffer.length) : '';
			const trailing = display.length - state.cursor;
			let line = '\r\x1b[2K' + prefix + display;
			if (trailing > 0) line += `\x1b[${trailing}D`;
			lines.push(line);
			lastRenderHeight = lines.length;
			process.stdout.write(lines.join('\n'));
		}

		function cleanup(): void {
			if (closed) return;
			closed = true;
			stdin.removeListener('data', onData);
			session.restore();
			process.stdout.write('\n');
		}

		function finish(exit: 'DONE' | 'CANCELLED'): void {
			cleanup();
			if (exit === 'DONE') resolve(state.buffer);
			else reject(new TerminateShellError());
		}

		function onData(chunk: Buffer | string): void {
			const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
			handleEvents(parseChunk(text));
		}

		function handleEvents(events: KeyEvent[]): void {
			if (events.length === 0) return;
			for (const evt of events) {
				state = reduceInputState(state, evt);
				if (state.exit) {
					finish(state.exit);
					return;
				}
			}
			render();
		}

		stdin.on('data', onData);
		render();
	});
}

// ---------------------------------------------------------------------------
// askInputWithAtTrigger — raw-mode keypress prompt with @ trigger
// ---------------------------------------------------------------------------

type AtTriggerOptions = {
	message: string;
	default?: string;
};

export async function askInputWithAtTrigger(
	opts: AtTriggerOptions
): Promise<string | typeof AT_TRIGGER> {
	reRefStdin();

	return new Promise<string | typeof AT_TRIGGER>((resolve, reject) => {
		const session = acquireStdin();
		const stdin = process.stdin;
		const prefix = `? ${pc.bold(opts.message)} `;
		let state: PromptState = {
			buffer: opts.default ?? '',
			cursor: (opts.default ?? '').length,
		};
		let closed = false;
		let lastRenderHeight = 0;

		function render(): void {
			if (lastRenderHeight > 0) {
				if (lastRenderHeight > 1) {
					process.stdout.write(`\x1b[${lastRenderHeight - 1}A`);
				}
				process.stdout.write('\r\x1b[0J');
			}
			const lines: string[] = [];
			const trailing = state.buffer.length - state.cursor;
			let line = '\r\x1b[2K' + prefix + state.buffer;
			if (trailing > 0) line += `\x1b[${trailing}D`;
			lines.push(line);
			lastRenderHeight = lines.length;
			process.stdout.write(lines.join('\n'));
		}

		function cleanup(): void {
			if (closed) return;
			closed = true;
			stdin.removeListener('data', onData);
			session.restore();
			process.stdout.write('\n');
		}

		function finish(exit: PromptExit): void {
			cleanup();
			switch (exit) {
				case 'DONE':
					resolve(state.buffer);
					return;
				case 'AT_TRIGGER':
					resolve(AT_TRIGGER);
					return;
				case 'CANCELLED':
					reject(new TerminateShellError());
					return;
			}
		}

		function onData(chunk: Buffer | string): void {
			const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
			handleEvents(parseChunk(text));
		}

		function handleEvents(events: KeyEvent[]): void {
			if (events.length === 0) return;
			for (const evt of events) {
				state = reduceKeystroke(state, evt);
				if (state.exit) {
					finish(state.exit);
					return;
				}
			}
			render();
		}

		stdin.on('data', onData);
		render();
	});
}

// ---------------------------------------------------------------------------
// Separator — placeholder for compatibility (no longer from inquirer)
// ---------------------------------------------------------------------------

export class Separator {
	name: string;
	constructor(name = '────────') {
		this.name = name;
	}
	static readonly separator = true;
}

// ---------------------------------------------------------------------------
// Deprecated shim — no longer creates a back signal, kept for compat
// ---------------------------------------------------------------------------

export function createCancelSignal(): { signal: AbortSignal; cleanup: () => void } {
	const ac = new AbortController();
	return { signal: ac.signal, cleanup: () => {} };
}

// ---------------------------------------------------------------------------
// Testing exports
// ---------------------------------------------------------------------------

export const __testing = {
	reduceKeystroke,
	reduceInputState,
	reduceSelectState,
	reduceSearchState,
	parseChunk,
	clampCursor,
};
