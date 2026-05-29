import { ExitPromptError, AbortPromptError } from '@inquirer/core';
import { input, password, select, search, Separator } from '@inquirer/prompts';
import pc from 'picocolors';

/**
 * Sentinel returned by `runWizard` step functions when the user pressed ESC.
 * `runWizard` decrements its cursor and re-runs the previous step.
 */
export const BACK = Symbol('__BACK__');

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
			// Possible bare ESC. Wait 60ms — if no follow-up bytes arrive,
			// it's a real ESC press, not the start of an arrow-key sequence
			// (which always sends 0x1b 0x5b followed by more bytes).
			if (escTimer) clearTimeout(escTimer);
			escTimer = setTimeout(() => {
				escTimer = null;
				ac.abort(new BackError());
				cleanup();
			}, 60);
		} else if (escTimer) {
			// More bytes followed the 0x1b within the debounce — not a back press.
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

async function runWithBackSignal<T>(
	fn: (signal: AbortSignal) => Promise<T>,
	opts: WrapOptions
): Promise<T | typeof BACK> {
	while (true) {
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
 * Handles errors that escape the wrapper helpers — primarily Ctrl+C
 * (`ExitPromptError`). On Ctrl+C we print "Cancelled." and exit cleanly.
 */
export function handlePromptError(err: unknown, cleanup?: () => void): void {
	cleanup?.();
	if (err instanceof ExitPromptError) {
		console.log(pc.dim('\nCancelled.\n'));
		process.exit(0);
	}
	if (err instanceof AbortPromptError && !isBackAbort(err)) {
		console.log(pc.dim('\nCancelled.\n'));
		process.exit(0);
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
