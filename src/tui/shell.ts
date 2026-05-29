import { createElement } from 'react';
import { render } from 'ink';
import pc from 'picocolors';
import { App } from './components/app.tsx';
import { loadInitialState, type ShellState } from './state.ts';
import { dispatch } from './dispatcher.ts';

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
		const result = await dispatch(line);
		if (result.kind === 'exit') return;
		if (result.kind === 'error' && result.error) {
			console.error(pc.red(`error: ${result.error.message}`));
		}
		lastExitCode = result.exitCode;
	}
}
