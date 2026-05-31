import { ExitPromptError, AbortPromptError } from '@inquirer/core';
import { input, password, select, search, Separator } from '@inquirer/prompts';
import pc from 'picocolors';

/**
 * Sentinel returned by `runWizard` step functions when the user pressed ESC.
 * `runWizard` decrements its cursor and re-runs the previous step.
 */
export const BACK = Symbol('__BACK__');
export const AT_TRIGGER = Symbol('__AT_TRIGGER__');

/**
 * Thrown by wizard prompts when the user presses single ESC. Caught by the
 * wrapper helpers (askInput / askSelect / askPassword / askSearch) and
 * translated to the `BACK` symbol that `runWizard` understands.
 */
export class BackError extends Error {
	constructor() {
		super('__BACK__');
		this.name = 'BackError';
	}
}

const FOOTER_HINT = pc.dim('  (esc to go back · ctrl+c to cancel)');
const FIRST_STEP_NO_BACK = pc.dim('  (nothing to go back to)');

type WrapOptions = {
	/**
	 * When true, ESC does not navigate back — instead it prints a brief
	 * "(nothing to go back to)" message and re-prompts. The footer hint is
	 * also suppressed (no "esc to go back" since back is unavailable).
	 */
	firstStep?: boolean;
};

/**
 * Creates an AbortSignal that aborts with `BackError` on single ESC.
 * The 60ms debounce window lets arrow-key escape sequences (which start with
 * 0x1b) pass through without being interpreted as ESC.
 *
 * Ctrl+C is handled by inquirer itself (ExitPromptError) — we don't intercept
 * it here. The terminal's SIGINT also propagates normally.
 */
function createBackSignal(): { signal: AbortSignal; cleanup: () => void } {
	const ac = new AbortController();
	let escTimer: ReturnType<typeof setTimeout> | null = null;

	function onData(chunk: Buffer): void {
		if (chunk.length === 1 && chunk[0] === 0x1b) {
			if (escTimer) clearTimeout(escTimer);
			escTimer = setTimeout(() => {
				escTimer = null;
				ac.abort(new BackError());
				cleanup();
			}, 60);
		} else if (escTimer) {
			clearTimeout(escTimer);
			escTimer = null;
		}
	}

	process.stdin.on('data', onData);

	function cleanup(): void {
		process.stdin.removeListener('data', onData);
		if (escTimer) {
			clearTimeout(escTimer);
			escTimer = null;
		}
	}

	return { signal: ac.signal, cleanup };
}

/**
 * Prints the footer hint above the next prompt. Inquirer renders its prompt
 * on the lines that follow this hint, so it appears directly under the
 * question text once inquirer takes over the cursor.
 */
function printFooterHint(firstStep: boolean): void {
	if (!firstStep) console.log(FOOTER_HINT);
}

function reRefStdin(): void {
	// Re-ref stdin before every prompt. Each prior prompt's readline
	// `output.end()` cleanup path (and Ink's earlier unmount) calls
	// stdin.unref(); without re-reffing, Node fires 'beforeExit'
	// between inquirer's createInterface and its first render tick,
	// and the process exits cleanly with code 0.
	try {
		(process.stdin as unknown as { ref?: () => void }).ref?.();
	} catch {
		/* ignore — not all stdin streams expose ref() */
	}
}

async function runWithBackSignal<T>(
	fn: (signal: AbortSignal) => Promise<T>,
	opts: WrapOptions
): Promise<T | typeof BACK> {
	while (true) {
		reRefStdin();
		const { signal, cleanup } = createBackSignal();
		try {
			return await fn(signal);
		} catch (err) {
			cleanup();
			if (isBackAbort(err)) {
				if (opts.firstStep) {
					console.log(FIRST_STEP_NO_BACK);
					continue;
				}
				return BACK;
			}
			throw err;
		} finally {
			cleanup();
		}
	}
}

function isBackAbort(err: unknown): boolean {
	if (err instanceof BackError) return true;
	if (err instanceof AbortPromptError) {
		const cause = (err as AbortPromptError & { cause?: unknown }).cause;
		if (cause instanceof BackError) return true;
		return err.message.includes('__BACK__');
	}
	return false;
}

type InputOptions = Parameters<typeof input>[0];
type SelectOptions<T> = Parameters<typeof select<T>>[0];
type PasswordOptions = Parameters<typeof password>[0];
type SearchOptions<T> = Parameters<typeof search<T>>[0];

export async function askInput(
	opts: InputOptions,
	wrap: WrapOptions = {}
): Promise<string | typeof BACK> {
	printFooterHint(wrap.firstStep ?? false);
	return runWithBackSignal((signal) => input(opts, { signal }), wrap);
}

export async function askSelect<T>(
	opts: SelectOptions<T>,
	wrap: WrapOptions = {}
): Promise<T | typeof BACK> {
	printFooterHint(wrap.firstStep ?? false);
	return runWithBackSignal((signal) => select(opts, { signal }), wrap);
}

export async function askPassword(
	opts: PasswordOptions,
	wrap: WrapOptions = {}
): Promise<string | typeof BACK> {
	printFooterHint(wrap.firstStep ?? false);
	return runWithBackSignal((signal) => password(opts, { signal }), wrap);
}

export async function askSearch<T>(
	opts: SearchOptions<T>,
	wrap: WrapOptions = {}
): Promise<T | typeof BACK> {
	printFooterHint(wrap.firstStep ?? false);
	return runWithBackSignal((signal) => search(opts, { signal }), wrap);
}

/**
 * Thrown by `handlePromptError` when a Ctrl+C or non-back AbortPromptError
 * escapes a wrapper helper. The TUI dispatcher catches this and keeps the
 * shell alive instead of exiting the whole process.
 */
export class CancelledError extends Error {
	constructor() {
		super('__CANCELLED__');
		this.name = 'CancelledError';
	}
}

/**
 * Handles errors that escape the wrapper helpers — primarily Ctrl+C
 * (`ExitPromptError`). On Ctrl+C we print "Cancelled." and throw a
 * CancelledError so the TUI shell can recover. In one-shot use the
 * top-level catch in src/index.ts (or the caller's own error handling)
 * decides what to do with it.
 */
export function handlePromptError(err: unknown, cleanup?: () => void): void {
	cleanup?.();
	if (err instanceof ExitPromptError) {
		console.log(pc.dim('\nCancelled.\n'));
		throw new CancelledError();
	}
	if (err instanceof AbortPromptError && !isBackAbort(err)) {
		console.log(pc.dim('\nCancelled.\n'));
		throw new CancelledError();
	}
	throw err;
}

/**
 * Back-compat shim for call sites that still use the pre-1.3.0 cancel-signal
 * pattern. New code should use `askInput`/`askSelect`/etc. directly.
 *
 * @deprecated Use the ask* wrappers; this remains only to ease migration of
 * any setup.ts/start.ts code that hasn't been ported yet.
 */
export function createCancelSignal(): { signal: AbortSignal; cleanup: () => void } {
	return createBackSignal();
}

export { Separator };

// ---------------------------------------------------------------------------
// askInputWithAtTrigger — raw-mode keypress prompt
// ---------------------------------------------------------------------------
//
// A small custom prompt that fully owns stdin for the duration of the
// question. We do this so the `@` keystroke can fire AT_TRIGGER on the same
// tick it is typed, with no chance of inquirer's readline consuming the byte
// first. The behaviour matches Claude Code's inline `@` file mention.
//
// Only the keys we actually need are handled: printable chars, Backspace,
// Delete, Left/Right, Home, End, Enter, Escape, Ctrl+C, and `@`. Anything else
// is ignored.

type KeyKind =
	| 'char'
	| 'enter'
	| 'backspace'
	| 'delete'
	| 'left'
	| 'right'
	| 'home'
	| 'end'
	| 'esc'
	| 'ctrlC'
	| 'at';

export type KeyEvent = { kind: Exclude<KeyKind, 'char'> } | { kind: 'char'; value: string };

export type PromptExit = 'AT_TRIGGER' | 'BACK' | 'DONE' | 'CANCELLED';

export type PromptState = {
	buffer: string;
	cursor: number;
	exit?: PromptExit;
};

/**
 * Pure state-machine for the raw-mode prompt. Exported so the line-editing
 * logic can be unit-tested without a TTY.
 */
export function reduceKeystroke(state: PromptState, key: KeyEvent): PromptState {
	if (state.exit) return state;
	switch (key.kind) {
		case 'at':
			return { ...state, exit: 'AT_TRIGGER' };
		case 'enter':
			return { ...state, exit: 'DONE' };
		case 'esc':
			return { ...state, exit: 'BACK' };
		case 'ctrlC':
			return { ...state, exit: 'CANCELLED' };
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

const ESC_DEBOUNCE_MS = 60;

/**
 * Parses a single incoming stdin chunk into an ordered list of KeyEvents.
 *
 * A bare `\x1b` is returned as `{ kind: 'esc' }` *only* when it stands alone
 * in the chunk — within a multi-byte chunk that starts with `\x1b[…` it is
 * the prefix of a CSI sequence and consumed silently. Truly bare `\x1b`
 * keystrokes are typically delivered in their own chunk and disambiguated by
 * the caller's 60ms debounce timer.
 */
export function parseChunk(chunk: string): KeyEvent[] {
	const out: KeyEvent[] = [];
	let i = 0;
	while (i < chunk.length) {
		const c = chunk[i]!;
		if (c === '\x1b') {
			// Escape-prefixed sequences
			if (i + 1 < chunk.length && chunk[i + 1] === '[') {
				// CSI sequence — read until a final byte in 0x40-0x7E
				let j = i + 2;
				while (j < chunk.length && (chunk[j]! < '@' || chunk[j]! > '~')) j++;
				const seq = chunk.slice(i, j + 1);
				const evt = csiEvent(seq);
				if (evt) out.push(evt);
				i = j + 1;
				continue;
			}
			// Lone ESC inside a chunk that has more bytes — treat as esc only when
			// nothing follows; otherwise drop it (likely a non-CSI sequence we don't
			// care about, e.g. Alt+key).
			if (i === chunk.length - 1) out.push({ kind: 'esc' });
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
		// Ignore other control chars
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
			return null; // Up — unsupported, ignore
		case '\x1b[B':
			return null; // Down — unsupported, ignore
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

type AtTriggerOptions = {
	message: string;
	default?: string;
};

/**
 * Asks for a single line of input, with the special behaviour that pressing
 * `@` at any point returns AT_TRIGGER **immediately** (without echoing the
 * character) so the caller can open a fuzzy file picker. Used by the
 * setup-project context-files question.
 *
 * Owns stdin in raw mode for the duration of the question. Restores the
 * previous raw-mode state on every exit path.
 */
export async function askInputWithAtTrigger(
	opts: AtTriggerOptions,
	wrap: WrapOptions = {}
): Promise<string | typeof BACK | typeof AT_TRIGGER> {
	printFooterHint(wrap.firstStep ?? false);
	reRefStdin();

	return new Promise<string | typeof BACK | typeof AT_TRIGGER>((resolve, reject) => {
		const stdin = process.stdin;
		const wasRaw = stdin.isRaw === true;
		const hadEncoding = stdin.readableEncoding;
		const prefix = `? ${pc.bold(opts.message)} `;
		let state: PromptState = {
			buffer: opts.default ?? '',
			cursor: (opts.default ?? '').length,
		};
		let escTimer: ReturnType<typeof setTimeout> | null = null;
		let closed = false;

		function render(): void {
			// Erase line, redraw prefix + buffer, then reposition cursor.
			const trailing = state.buffer.length - state.cursor;
			process.stdout.write('\r\x1b[2K');
			process.stdout.write(prefix);
			process.stdout.write(state.buffer);
			if (trailing > 0) process.stdout.write(`\x1b[${trailing}D`);
		}

		function cleanup(): void {
			if (closed) return;
			closed = true;
			stdin.removeListener('data', onData);
			if (escTimer) {
				clearTimeout(escTimer);
				escTimer = null;
			}
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
				case 'BACK':
					if (wrap.firstStep) {
						console.log(FIRST_STEP_NO_BACK);
						// Re-enter the prompt for first-step behaviour.
						askInputWithAtTrigger(opts, wrap).then(resolve, reject);
						return;
					}
					resolve(BACK);
					return;
				case 'CANCELLED':
					reject(new ExitPromptError('User cancelled prompt'));
					return;
			}
		}

		function onData(chunk: Buffer | string): void {
			const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

			// Bare-ESC debounce: a lone 0x1b might be a real Escape, or the prefix
			// of a CSI sequence that arrives in a follow-up chunk. Wait 60ms before
			// committing to BACK.
			if (text === '\x1b' && !escTimer) {
				escTimer = setTimeout(() => {
					escTimer = null;
					finish('BACK');
				}, ESC_DEBOUNCE_MS);
				return;
			}
			if (escTimer) {
				// Either the CSI follow-up or any other key; either way the bare-ESC
				// hypothesis is wrong. Cancel the timer and merge the bytes so the
				// parser sees the full CSI sequence.
				clearTimeout(escTimer);
				escTimer = null;
				const merged = '\x1b' + text;
				return handleEvents(parseChunk(merged));
			}
			handleEvents(parseChunk(text));
		}

		function handleEvents(events: KeyEvent[]): void {
			for (const evt of events) {
				state = reduceKeystroke(state, evt);
				if (state.exit) {
					finish(state.exit);
					return;
				}
			}
			render();
		}

		if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding('utf8');
		stdin.on('data', onData);
		render();
	});
}

export const __testing = { reduceKeystroke, parseChunk };
