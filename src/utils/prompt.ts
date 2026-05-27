import { ExitPromptError, AbortPromptError } from '@inquirer/core';
import pc from 'picocolors';
import { Separator } from '@inquirer/core';

export const BACK = Symbol('__BACK__');

export function createCancelSignal(): { signal: AbortSignal; cleanup: () => void } {
	const ac = new AbortController();
	let escTimer: ReturnType<typeof setTimeout> | null = null;

	function onData(chunk: Buffer) {
		if (chunk.length === 1 && chunk[0] === 0x1b) {
			if (escTimer) {
				clearTimeout(escTimer);
				ac.abort(new Error('Cancelled by user'));
				cleanup();
			} else {
				escTimer = setTimeout(() => {
					escTimer = null;
				}, 60);
			}
		} else {
			if (escTimer) {
				clearTimeout(escTimer);
				escTimer = null;
			}
		}
	}

	process.stdin.on('data', onData);

	function cleanup() {
		process.stdin.removeListener('data', onData);
		if (escTimer) clearTimeout(escTimer);
	}

	return { signal: ac.signal, cleanup };
}

export function handlePromptError(err: unknown, cleanup?: () => void): void {
	cleanup?.();
	if (err instanceof ExitPromptError || err instanceof AbortPromptError) {
		console.log(pc.dim('\nCancelled.\n'));
		process.exit(0);
	}
	throw err;
}

export { Separator };
