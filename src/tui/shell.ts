import { createElement } from 'react';
import { render } from 'ink';
import pc from 'picocolors';
import { LandingApp } from './components/landing-app.tsx';
import { loadInitialState, type ShellState } from './state.ts';
import { dispatch } from './dispatcher.ts';
import { TerminateShellError } from '~/utils/prompt.ts';
import { loadHistory, appendHistory } from './history.ts';

type RenderResult = { value: string; terminated: boolean };

async function renderShellOnce(
	state: ShellState,
	_lastExitCode: number | null,
	_history: string[]
): Promise<RenderResult> {
	let submitted = '';
	let terminated = false;
	const instance = render(
		createElement(LandingApp, {
			state,
			_lastExitCode,
			_history,
			onSubmit: (value: string) => {
				submitted = value;
				instance.unmount();
			},
			onTerminate: () => {
				terminated = true;
				instance.unmount();
			},
		}),
		{ exitOnCtrlC: false }
	);
	await instance.waitUntilExit();
	try {
		(process.stdin as unknown as { ref?: () => void }).ref?.();
	} catch {
		/* not all stdin streams expose ref(); safe to ignore */
	}
	await new Promise((r) => setImmediate(r));
	return { value: submitted, terminated };
}

export async function runShell(): Promise<void> {
	let lastExitCode: number | null = null;
	let history = await loadHistory();
	while (true) {
		const state = await loadInitialState();
		const { value, terminated } = await renderShellOnce(state, lastExitCode, history);
		if (terminated) return;
		const line = value.trim();
		if (!line) continue;
		await appendHistory(line);
		history = await loadHistory();
		let result;
		try {
			result = await dispatch(line);
		} catch (err) {
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
