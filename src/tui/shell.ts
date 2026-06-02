import { createElement } from 'react';
import { render } from 'ink';
import { App } from './components/app.tsx';
import { loadInitialState, type ShellState } from './state.ts';
import { dispatch } from './dispatcher.ts';
import { TerminateShellError } from '~/utils/prompt.ts';
import { loadHistory, appendHistory } from './history.ts';
import {
	createActivityState,
	pushActivity,
	type ActivityState,
	type ActivityEntry,
} from './activity.ts';
import { clearScreen } from './builtins.ts';

const INTERACTIVE_COMMANDS = new Set(['setup', 'setup-project', 'setup-transitions']);

function normalizeAlias(line: string): string {
	const tokens = line.trim().split(/\s+/);
	const first = tokens[0]?.toLowerCase() ?? '';
	if (first === 'setup' && tokens[1]?.toLowerCase() === 'project') {
		return ['setup-project', ...tokens.slice(2)].join(' ');
	}
	if (first === 'setup' && tokens[1]?.toLowerCase() === 'transitions') {
		return ['setup-transitions', ...tokens.slice(2)].join(' ');
	}
	return line;
}

function isInteractiveCommand(line: string): boolean {
	const first = line.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
	return INTERACTIVE_COMMANDS.has(first);
}

function isTaskCommand(line: string): boolean {
	const first = line.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
	return (
		first === 'start' ||
		first === 'continue' ||
		first === 'done' ||
		first === 'abort' ||
		first === 'new'
	);
}

async function runWithOutputCapture(
	line: string
): Promise<{ exitCode: number; stdout: string; stderr: string; error: Error | undefined }> {
	const stdoutChunks: string[] = [];
	const stderrChunks: string[] = [];
	const origStdoutWrite = process.stdout.write.bind(process.stdout);
	const origStderrWrite = process.stderr.write.bind(process.stderr);

	process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
		if (typeof chunk === 'string') stdoutChunks.push(chunk);
		else if (Buffer.isBuffer(chunk)) stdoutChunks.push(chunk.toString('utf8'));
		const cb = args.find((a) => typeof a === 'function') as ((err?: Error) => void) | undefined;
		if (cb) cb();
		return true;
	}) as typeof process.stdout.write;

	process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
		if (typeof chunk === 'string') stderrChunks.push(chunk);
		else if (Buffer.isBuffer(chunk)) stderrChunks.push(chunk.toString('utf8'));
		const cb = args.find((a) => typeof a === 'function') as ((err?: Error) => void) | undefined;
		if (cb) cb();
		return true;
	}) as typeof process.stderr.write;

	try {
		const result = await dispatch(line);
		return {
			exitCode: result.exitCode,
			stdout: stdoutChunks.join(''),
			stderr: stderrChunks.join(''),
			error: result.kind === 'error' ? result.error : undefined,
		};
	} finally {
		process.stdout.write = origStdoutWrite;
		process.stderr.write = origStderrWrite;
	}
}

type ShellResult =
	| { action: 'exit' }
	| { action: 'continue'; activity: ActivityState; shellState: ShellState };

async function renderSession(
	shellState: ShellState,
	activity: ActivityState
): Promise<ShellResult> {
	return new Promise<ShellResult>((resolve) => {
		let resolved = false;
		const finish = (result: ShellResult) => {
			if (resolved) return;
			resolved = true;
			instance.unmount();
			resolve(result);
		};

		const instance = render(
			createElement(App, {
				state: shellState,
				onSubmit: (value: string) => {
					if (resolved) return;
					const trimmed = value.trim();
					if (!trimmed) return;
					void handleCommand(trimmed);
				},
				onTerminate: () => finish({ action: 'exit' }),
				running: false,
				activity,
			}),
			{ exitOnCtrlC: false }
		);

		async function handleCommand(line: string): Promise<void> {
			const normalized = normalizeAlias(line);
			await appendHistory(normalized);

			let nextActivity = pushActivity(activity, { kind: 'user-task', text: normalized });

			if (normalized === 'clear') {
				clearScreen();
				const freshState = await loadInitialState();
				finish({ action: 'continue', activity: createActivityState(), shellState: freshState });
				return;
			}

			if (isInteractiveCommand(normalized)) {
				instance.unmount();
				try {
					(process.stdin as unknown as { ref?: () => void }).ref?.();
				} catch {
					/* ignore */
				}
				await new Promise((r) => setImmediate(r));

				try {
					const result = await dispatch(normalized);
					if (result.kind === 'exit') {
						resolve({ action: 'exit' });
						return;
					}
					nextActivity = pushActivity(nextActivity, {
						kind: result.exitCode === 0 ? 'success' : 'error',
						text: result.exitCode === 0 ? `${normalized} completed` : `${normalized} failed`,
						exitCode: result.exitCode,
					} as ActivityEntry);
					if (result.kind === 'error' && result.error) {
						nextActivity = pushActivity(nextActivity, {
							kind: 'error',
							text: result.error.message,
						});
					}
				} catch (err) {
					if (err instanceof TerminateShellError) {
						resolve({ action: 'exit' });
						return;
					}
					nextActivity = pushActivity(nextActivity, {
						kind: 'error',
						text: (err as Error).message ?? String(err),
					});
				}

				const freshState = await loadInitialState();
				const subResult = await renderSession(freshState, nextActivity);
				finish(subResult);
				return;
			}

			instance.rerender(
				createElement(App, {
					state: shellState,
					onSubmit: (value: string) => {
						if (resolved) return;
						const t = value.trim();
						if (!t) return;
						void handleCommand(t);
					},
					onTerminate: () => finish({ action: 'exit' }),
					running: true,
					activity: nextActivity,
				})
			);

			try {
				const captured = await runWithOutputCapture(normalized);

				const outText = captured.stdout.trim();
				if (outText) {
					nextActivity = pushActivity(nextActivity, { kind: 'command-output', text: outText });
				}
				const errText = captured.stderr.trim();
				if (errText) {
					nextActivity = pushActivity(nextActivity, { kind: 'warning', text: errText });
				}
				if (captured.error) {
					nextActivity = pushActivity(nextActivity, {
						kind: 'error',
						text: captured.error.message,
					});
				}
				if (normalized !== 'help' && normalized !== '?') {
					nextActivity = pushActivity(nextActivity, {
						kind: captured.exitCode === 0 ? 'success' : 'error',
						text: captured.exitCode === 0 ? `${normalized} completed` : `${normalized} failed`,
						exitCode: captured.exitCode,
					} as ActivityEntry);
				}
			} catch (err) {
				if (err instanceof TerminateShellError) {
					finish({ action: 'exit' });
					return;
				}
				nextActivity = pushActivity(nextActivity, {
					kind: 'error',
					text: (err as Error).message ?? String(err),
				});
			}

			const freshState = await loadInitialState();
			instance.rerender(
				createElement(App, {
					state: freshState,
					onSubmit: (value: string) => {
						if (resolved) return;
						const t = value.trim();
						if (!t) return;
						void handleCommand(t);
					},
					onTerminate: () => finish({ action: 'exit' }),
					running: false,
					activity: nextActivity,
				})
			);
		}
	});
}

export async function runShell(): Promise<void> {
	await loadHistory();
	const initialState = await loadInitialState();
	let result = await renderSession(initialState, createActivityState());
	while (result.action === 'continue') {
		result = await renderSession(result.shellState, result.activity);
	}
}

export const __testing = { normalizeAlias, isInteractiveCommand, isTaskCommand };
