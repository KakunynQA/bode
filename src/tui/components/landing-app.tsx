import { Box, Text, useInput } from 'ink';
import { useState, useCallback } from 'react';
import { selectArt, centerArt } from '../logo.ts';
import { renderHelp } from '../builtins.ts';
import { ComposerPanel } from './composer-panel.tsx';
import { CommandPalette } from './command-palette.tsx';
import { StatusBar } from './status-bar.tsx';
import type { ShellState } from '../state.ts';

const PEACH = '#FAB283';
const TIPS = [
	'Press Ctrl+P to browse commands.',
	'Run /help to view shortcuts.',
	'Start with a task description and Bode will create an orchestrated run.',
];

type LandingView = 'idle' | 'palette' | 'help' | 'leader';

type Props = {
	state: ShellState;
	_lastExitCode: number | null;
	_history: string[];
	onSubmit: (value: string) => void;
	onTerminate: () => void;
};

export function LandingApp({
	state,
	_lastExitCode,
	_history,
	onSubmit,
	onTerminate,
}: Props): JSX.Element {
	const [view, setView] = useState<LandingView>('idle');
	const [tipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));
	const [showHelp, setShowHelp] = useState(false);
	const [leaderHint, setLeaderHint] = useState(false);

	const termCols = process.stdout.columns ?? 80;
	const termRows = process.stdout.rows ?? 24;

	const { art } = selectArt(termCols, termRows);
	const centeredArt = centerArt(art, termCols);

	const handlePaletteClose = useCallback(() => setView('idle'), []);
	const handlePaletteSelect = useCallback(
		(commandId: string) => {
			setView('idle');
			switch (commandId) {
				case 'open-help':
					setShowHelp(true);
					break;
				case 'clear-prompt':
					break;
				case 'view-version':
					break;
				case 'view-project':
					break;
				case 'exit':
					onTerminate();
					break;
			}
		},
		[onTerminate]
	);

	const handleSubmit = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (trimmed === '/help') {
				setShowHelp(true);
				return;
			}
			onSubmit(trimmed);
		},
		[onSubmit]
	);

	const handleLeaderKey = useCallback(() => {
		setLeaderHint(true);
	}, []);

	useInput(
		(input, key) => {
			if (key.escape) {
				if (showHelp) {
					setShowHelp(false);
					return;
				}
				if (leaderHint) {
					setLeaderHint(false);
					return;
				}
			}
			if (leaderHint) {
				setLeaderHint(false);
				const ch = input.toLowerCase();
				if (ch === 'l') onSubmit('list');
				else if (ch === 's') onSubmit('doctor');
				else if (ch === 'h') setShowHelp(true);
				else if (ch === 'q') onTerminate();
			}
		},
		{ isActive: view === 'idle' && (showHelp || leaderHint) }
	);

	const planningCli = 'Plan';
	const metadata = `${planningCli} · ${state.project?.trackerKind ?? 'local'} tracker`;

	return (
		<Box flexDirection="column" minHeight={termRows}>
			<Box flexDirection="column" alignItems="center" marginTop={1}>
				<Text color="cyan">{centeredArt}</Text>
			</Box>

			<Box flexDirection="column" alignItems="center" marginTop={0}>
				{view === 'idle' && !showHelp && !leaderHint && (
					<ComposerPanel
						metadata={metadata}
						onSubmit={handleSubmit}
						onTerminate={onTerminate}
						onOpenPalette={() => setView('palette')}
						onLeaderKey={handleLeaderKey}
					/>
				)}
			</Box>

			{showHelp && (
				<Box flexDirection="column" paddingX={2}>
					<Text>{renderHelp()}</Text>
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

			<Box marginTop={1}>
				<Text color={PEACH}>{'  \u25CF'}</Text>
				<Text dimColor>{' Tip  '}</Text>
				<Text dimColor>{TIPS[tipIdx]}</Text>
			</Box>

			{view === 'palette' && (
				<Box marginTop={1}>
					<CommandPalette onClose={handlePaletteClose} onSelect={handlePaletteSelect} />
				</Box>
			)}

			<Box flexGrow={1} />

			<StatusBar state={state} />
		</Box>
	);
}
