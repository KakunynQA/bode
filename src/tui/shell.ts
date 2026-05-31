import { createElement } from 'react';
import { render } from 'ink';
import pc from 'picocolors';
import { App } from './components/app.tsx';
import { loadInitialState, type ShellState } from './state.ts';
import { dispatch } from './dispatcher.ts';
import { TerminateShellError } from '~/utils/prompt.ts';

declare const __GOAT_ART__: string;

function printBanner(state: ShellState): void {
	if (typeof __GOAT_ART__ !== 'undefined' && __GOAT_ART__) {
		console.log(__GOAT_ART__);
	}
	console.log(pc.bold(pc.cyan('bode')) + pc.dim(` v${state.version} — interactive shell`));
	console.log(pc.dim("type 'help' for commands · 'exit' to quit"));
	console.log('');
}

async function renderShellOnce(state: ShellState, lastExitCode: number | null): Promise<string> {
	let submitted = '';
	const instance = render(
		createElement(App, {
			state,
			lastExitCode,
			onSubmit: (value: string) => {
				submitted = value;
				instance.unmount();
			},
		})
	);
	// Wait for Ink to finish unmounting (raw-mode toggle, listener removal,
	// stdin pause) before handing the terminal to the dispatcher / inquirer.
	// Skipping this step left residual bytes / handlers around that inquirer
	// interpreted as a Ctrl+C, instantly cancelling the first prompt.
	await instance.waitUntilExit();
	// Re-ref stdin. Ink's componentWillUnmount calls stdin.unref() when it
	// disables raw mode. If we don't undo it before the dispatcher hands
	// the terminal to @inquirer/prompts, the only handle keeping the event
	// loop alive is gone — inquirer's readline.createInterface schedules
	// its first render via setImmediate, the loop empties between those
	// two ticks, Node fires 'beforeExit' and the process exits cleanly
	// with code 0 (no error, no signal). That looks like the wizard
	// "rendered Q1 then died on its own".
	try {
		(process.stdin as unknown as { ref?: () => void }).ref?.();
	} catch {
		/* not all stdin streams expose ref(); safe to ignore */
	}
	// Give Node one more tick so any pending stdin 'data' callbacks fire and
	// drain before inquirer attaches its own listeners. Cheap insurance.
	await new Promise((r) => setImmediate(r));
	return submitted;
}

export async function runShell(): Promise<void> {
	let lastExitCode: number | null = null;
	let first = true;
	while (true) {
		const state = await loadInitialState();
		if (first) {
			printBanner(state);
			first = false;
		}
		const line = (await renderShellOnce(state, lastExitCode)).trim();
		if (!line) continue;
		let result;
		try {
			result = await dispatch(line);
		} catch (err) {
			// Ctrl+C inside an action propagates as TerminateShellError —
			// shut the shell down cleanly. Any other error here is genuinely
			// unexpected; rethrow so it surfaces.
			if (err instanceof TerminateShellError) return;
			throw err;
		}
		if (result.kind === 'exit') return;
		if (result.kind === 'error' && result.error) {
			console.error(pc.red(`error: ${result.error.message}`));
		}
		lastExitCode = result.exitCode;
	}
}
