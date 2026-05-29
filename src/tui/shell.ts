import { createElement } from 'react';
import { render } from 'ink';
import pc from 'picocolors';
import { App } from './components/app.tsx';
import { loadInitialState, type ShellState } from './state.ts';

declare const __GOAT_ART__: string;

const EXIT_WORDS = new Set(['exit', 'quit', ':q']);

function printBanner(state: ShellState): void {
	if (typeof __GOAT_ART__ !== 'undefined' && __GOAT_ART__) {
		console.log(__GOAT_ART__);
	}
	console.log(pc.bold(pc.cyan('bode')) + pc.dim(` v${state.version} — interactive shell`));
	console.log(pc.dim("type 'help' for commands · 'exit' to quit"));
	console.log('');
}

async function renderShellOnce(state: ShellState, lastExitCode: number | null): Promise<string> {
	return new Promise((resolve) => {
		const handleSubmit = (value: string): void => {
			instance.unmount();
			resolve(value);
		};
		const instance = render(
			createElement(App, { state, lastExitCode, onSubmit: handleSubmit })
		);
	});
}

// Phase-2 stub. Phase 3 replaces this with the real dispatcher.
async function stubDispatch(line: string): Promise<number> {
	console.log(pc.dim(`[stub dispatched] ${line}`));
	return 0;
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
		if (EXIT_WORDS.has(line.toLowerCase())) return;
		lastExitCode = await stubDispatch(line);
	}
}
