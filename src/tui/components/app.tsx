import { Box, Text, useApp, useInput } from 'ink';
import { useState, useCallback } from 'react';
import { selectArt, centerArt } from '../logo.ts';
import { ComposerPanel } from './composer-panel.tsx';
import { CommandPalette } from './command-palette.tsx';
import { StatusBar } from './status-bar.tsx';
import { createComposerState, reduceComposer, type ComposerState } from '../composer.ts';
import { type ActivityState, activityIsEmpty } from '../activity.ts';
import type { ShellState } from '../state.ts';

const PEACH = '#FAB283';

type DialogKind = 'palette' | 'help' | 'leader';

type Props = {
	state: ShellState;
	onSubmit: (value: string) => void;
	onTerminate: () => void;
	running: boolean;
	activity: ActivityState;
};

function ActivityView({ activity }: { activity: ActivityState }): JSX.Element {
	return (
		<Box flexDirection="column" paddingX={2}>
			{activity.entries.map((entry, i) => {
				switch (entry.kind) {
					case 'user-task':
						return (
							<Box key={i} flexDirection="column" marginBottom={1}>
								<Box>
									<Text color={PEACH}>{'  \u25B9 '}</Text>
									<Text bold>{entry.text}</Text>
								</Box>
							</Box>
						);
					case 'phase-start':
						return (
							<Box key={i} flexDirection="column" marginLeft={2} marginBottom={0}>
								<Text color="cyan" bold>
									{entry.phase}
								</Text>
							</Box>
						);
					case 'phase-complete':
						return (
							<Box key={i} flexDirection="column" marginLeft={2} marginBottom={1}>
								<Text color="green">
									{'\u2713 '}
									{entry.phase} complete
								</Text>
								{entry.taskKey && (
									<Text dimColor>
										{'  '}
										{entry.taskKey} {'\u00B7'} {entry.phase}
									</Text>
								)}
							</Box>
						);
					case 'command-output':
						return (
							<Box key={i} marginLeft={2}>
								<Text dimColor>{entry.text}</Text>
							</Box>
						);
					case 'artifact':
						return (
							<Box key={i} marginLeft={2}>
								<Text dimColor>
									{entry.label}: {entry.path}
								</Text>
							</Box>
						);
					case 'info':
						return (
							<Box key={i} marginLeft={2}>
								<Text dimColor>{entry.text}</Text>
							</Box>
						);
					case 'warning':
						return (
							<Box key={i} marginLeft={2}>
								<Text color="yellow">{'! ' + entry.text}</Text>
							</Box>
						);
					case 'error':
						return (
							<Box key={i} marginLeft={2}>
								<Text color="red">{'error: ' + entry.text}</Text>
								{entry.exitCode !== undefined && entry.exitCode !== 0 && (
									<Text dimColor>{' (exit ' + entry.exitCode + ')'}</Text>
								)}
							</Box>
						);
					case 'success':
						return (
							<Box key={i} marginLeft={2} marginBottom={1}>
								<Text color="green">
									{'\u2713 '}
									{entry.text}
								</Text>
								{entry.exitCode !== undefined && entry.exitCode !== 0 && (
									<Text dimColor>{' (exit ' + entry.exitCode + ')'}</Text>
								)}
							</Box>
						);
				}
			})}
		</Box>
	);
}

export function App({ state, onSubmit, onTerminate, running, activity }: Props): JSX.Element {
	const { exit: inkExit } = useApp();
	const [dialog, setDialog] = useState<DialogKind | null>(null);
	const [composerState, setComposerState] = useState<ComposerState>(createComposerState());

	const termCols = process.stdout.columns ?? 80;
	const termRows = process.stdout.rows ?? 24;
	const showSplash = activityIsEmpty(activity);

	const handleTerminate = useCallback(() => {
		onTerminate();
		inkExit();
	}, [onTerminate, inkExit]);

	const handleComposerSubmit = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (trimmed === '/help' || trimmed === 'help') {
				setDialog('help');
				return;
			}
			onSubmit(trimmed);
		},
		[onSubmit]
	);

	const handleLeaderKey = useCallback(() => {
		if (!dialog) setDialog('leader');
	}, [dialog]);

	const handlePaletteInsert = useCallback(
		(insertText: string) => {
			setDialog(null);
			if (insertText === 'exit') {
				handleTerminate();
				return;
			}
			const newState = reduceComposer(createComposerState(), {
				kind: 'setText',
				value: insertText,
			});
			setComposerState(newState);
		},
		[handleTerminate]
	);

	useInput(
		(input, key) => {
			if (!key.escape) return;
			if (dialog) {
				setDialog(null);
				return;
			}
		},
		{ isActive: dialog !== null }
	);

	useInput(
		(input, _key) => {
			if (dialog === 'leader') {
				setDialog(null);
				const ch = input.toLowerCase();
				if (ch === 'l') onSubmit('list');
				else if (ch === 's') onSubmit('doctor');
				else if (ch === 'h') setDialog('help');
				else if (ch === 'q') handleTerminate();
			}
		},
		{ isActive: dialog === 'leader' }
	);

	const composerActive = dialog === null && !running;

	const statusLine = running
		? '\u25D0 running...'
		: state.activeRun
			? `\u2713 ${state.activeRun.key} \u00B7 ${state.activeRun.phase}`
			: '';

	return (
		<Box flexDirection="column" minHeight={termRows}>
			<Box flexDirection="column" flexGrow={1}>
				{showSplash ? (
					<Box flexDirection="column" alignItems="center" marginTop={2}>
						<Text color="cyan">{centerArt(selectArt(termCols, termRows).art, termCols)}</Text>
					</Box>
				) : (
					<Box flexDirection="column" marginTop={1}>
						<ActivityView activity={activity} />
					</Box>
				)}

				{dialog === 'help' && (
					<Box flexDirection="column" alignItems="center" marginTop={1}>
						<Box
							flexDirection="column"
							width={64}
							borderStyle="round"
							borderColor="gray"
							paddingX={1}
						>
							<Text bold>{'Available commands:'}</Text>
							{[
								'',
								'  setup                        Configure tracker, AI CLIs, VCS',
								'  setup-project                Create or edit a project config',
								'  start <KEY>                  Start a task (planning phase)',
								'  continue <KEY>               Advance to next phase',
								'  done <KEY>                   Mark task done',
								'  abort <KEY>                  Cancel execution, clean up branch',
								'  status <KEY>                 Show phase, branch, PR, cost',
								'  list                         List locally tracked tasks',
								'  doctor                       Diagnose env, config, CLIs, VCS',
								'  new <summary>                Create local task',
								'  log <KEY>                    Show current/last phase log',
								'  skills                       Show or install skills',
								'  clear                        Clear screen',
								'  help                         Show this list',
								'  exit                         Exit the shell',
								'',
								'Anything else is sent to the freeform fast path.',
							].map((line, i) => (
								<Text key={i}>{line}</Text>
							))}
							<Box marginTop={1}>
								<Text dimColor>Press Esc to close</Text>
							</Box>
						</Box>
					</Box>
				)}

				{dialog === 'leader' && (
					<Box paddingX={2}>
						<Text dimColor>
							ctrl+x{'  '}l list{'  '}s doctor{'  '}h help{'  '}q quit
						</Text>
					</Box>
				)}

				{dialog === 'palette' && (
					<Box flexDirection="column" alignItems="center" marginTop={1}>
						<CommandPalette
							onClose={() => setDialog(null)}
							onSelectInsert={handlePaletteInsert}
							termCols={termCols}
						/>
					</Box>
				)}
			</Box>

			<Box flexDirection="column" marginTop={1}>
				<ComposerPanel
					state={composerState}
					onChange={setComposerState}
					onSubmit={handleComposerSubmit}
					onTerminate={handleTerminate}
					onOpenPalette={() => setDialog('palette')}
					onLeaderKey={handleLeaderKey}
					disabled={running}
					active={composerActive}
					statusLine={statusLine}
					shellState={state}
				/>
			</Box>

			<StatusBar state={state} />
		</Box>
	);
}
