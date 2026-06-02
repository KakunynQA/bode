import { Box, Text, useApp, useInput } from 'ink';
import { useState, useCallback } from 'react';
import { selectArt, centerArt } from '../logo.ts';
import { ComposerPanel } from './composer-panel.tsx';
import { CommandPalette } from './command-palette.tsx';
import { StatusBar } from './status-bar.tsx';
import { timelineIsEmpty, type TimelineState } from '../timeline.ts';
import { createComposerState, reduceComposer, type ComposerState } from '../composer.ts';
import type { ShellState } from '../state.ts';

const PEACH = '#FAB283';

type ViewMode = 'idle' | 'palette' | 'help' | 'leader';

type Props = {
	state: ShellState;
	onSubmit: (value: string) => void;
	onTerminate: () => void;
	running: boolean;
	timeline: TimelineState;
};

function TimelineView({ timeline }: { timeline: TimelineState }): JSX.Element {
	return (
		<Box flexDirection="column" paddingX={2}>
			{timeline.entries.map((entry, i) => {
				switch (entry.kind) {
					case 'user':
						return (
							<Box key={i} marginBottom={0}>
								<Text color={PEACH}>{'> '}</Text>
								<Text bold>{entry.text}</Text>
							</Box>
						);
					case 'stdout':
						return (
							<Box key={i}>
								<Text>{entry.text}</Text>
							</Box>
						);
					case 'stderr':
						return (
							<Box key={i}>
								<Text color="red">{entry.text}</Text>
							</Box>
						);
					case 'error':
						return (
							<Box key={i}>
								<Text color="red">{'error: ' + entry.text}</Text>
							</Box>
						);
					case 'info':
						return (
							<Box key={i}>
								<Text dimColor>{entry.text}</Text>
							</Box>
						);
					case 'success':
						return (
							<Box key={i}>
								<Text color="green">
									{'\u2713 '}
									{entry.text}
									{entry.exitCode !== 0 ? ` (exit ${entry.exitCode})` : ''}
								</Text>
							</Box>
						);
				}
			})}
		</Box>
	);
}

export function LandingApp({
	state,
	onSubmit,
	onTerminate,
	running,
	timeline,
}: Props): JSX.Element {
	const { exit: inkExit } = useApp();
	const [view, setView] = useState<ViewMode>('idle');
	const [composerState, setComposerState] = useState<ComposerState>(createComposerState());
	const [leaderHint, setLeaderHint] = useState(false);

	const termCols = process.stdout.columns ?? 80;
	const termRows = process.stdout.rows ?? 24;
	const showSplash = timelineIsEmpty(timeline);

	const handleTerminate = useCallback(() => {
		onTerminate();
		inkExit();
	}, [onTerminate, inkExit]);

	const handleComposerSubmit = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (trimmed === '/help' || trimmed === 'help') {
				setView('help');
				return;
			}
			onSubmit(trimmed);
		},
		[onSubmit]
	);

	const handleLeaderKey = useCallback(() => {
		if (view === 'idle') {
			setLeaderHint(true);
		}
	}, [view]);

	const handlePaletteInsert = useCallback(
		(insertText: string) => {
			setView('idle');
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
			if (view === 'palette') {
				setView('idle');
				return;
			}
			if (view === 'help') {
				setView('idle');
				return;
			}
			if (leaderHint) {
				setLeaderHint(false);
				return;
			}
		},
		{ isActive: view !== 'idle' || leaderHint }
	);

	useInput(
		(input, _key) => {
			if (leaderHint && view === 'idle') {
				setLeaderHint(false);
				const ch = input.toLowerCase();
				if (ch === 'l') onSubmit('list');
				else if (ch === 's') onSubmit('doctor');
				else if (ch === 'h') setView('help');
				else if (ch === 'q') handleTerminate();
			}
		},
		{ isActive: leaderHint && view === 'idle' }
	);

	return (
		<Box flexDirection="column" minHeight={termRows}>
			<Box flexDirection="column" flexGrow={1}>
				{showSplash ? (
					<Box flexDirection="column" alignItems="center" marginTop={1}>
						<Text color="cyan">{centerArt(selectArt(termCols, termRows).art, termCols)}</Text>
					</Box>
				) : (
					<TimelineView timeline={timeline} />
				)}

				{view === 'help' && (
					<Box flexDirection="column" paddingX={2} marginTop={1}>
						<Text>
							{[
								'Available commands:',
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
							].join('\n')}
						</Text>
						<Box marginTop={1}>
							<Text dimColor>Press Esc to close</Text>
						</Box>
					</Box>
				)}

				{leaderHint && (
					<Box paddingX={2}>
						<Text dimColor>
							ctrl+x{'  '}l list{'  '}s doctor{'  '}h help{'  '}q quit
						</Text>
					</Box>
				)}

				{view === 'palette' && (
					<Box flexDirection="column" alignItems="center" marginTop={1}>
						<CommandPalette
							onClose={() => setView('idle')}
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
					onOpenPalette={() => setView('palette')}
					onLeaderKey={handleLeaderKey}
					disabled={running}
					active={view === 'idle' && !leaderHint}
				/>
			</Box>

			<StatusBar state={state} />
		</Box>
	);
}
