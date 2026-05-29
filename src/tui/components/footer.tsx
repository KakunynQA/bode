import { Box, Text } from 'ink';
import type { ShellState } from '../state.ts';

type Props = {
	state: ShellState;
	lastExitCode: number | null;
};

export function Footer({ state, lastExitCode }: Props): JSX.Element {
	const runLabel = state.activeRun
		? `${state.activeRun.key} · ${state.activeRun.phase}`
		: 'no active run';
	const exitLabel = lastExitCode === null ? '—' : String(lastExitCode);
	const exitColor = lastExitCode === null || lastExitCode === 0 ? 'gray' : 'red';

	return (
		<Box paddingX={1} flexDirection="row" justifyContent="space-between">
			<Text>
				<Text dimColor>→ </Text>
				<Text color="cyan">{runLabel}</Text>
				<Text dimColor> · last exit </Text>
				<Text color={exitColor}>{exitLabel}</Text>
			</Text>
			<Text dimColor>(↵ run · ctrl+c exit · type 'help')</Text>
		</Box>
	);
}
