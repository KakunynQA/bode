import { Box, Text } from 'ink';
import type { ShellState } from '../state.ts';

type Props = {
	state: ShellState;
};

export function StatusBar({ state }: Props): JSX.Element {
	const cwd = state.project?.workdir ?? process.cwd();
	const cwdShort = cwd.split(/[/\\]/).slice(-2).join('/');

	const trackerLabel = state.project?.trackerKind ?? 'local';
	const runLabel = state.activeRun ? `${state.activeRun.key} · ${state.activeRun.phase}` : '';

	const centerParts: string[] = [];
	if (trackerLabel) centerParts.push(`${trackerLabel} tracker`);
	if (runLabel) centerParts.push(runLabel);
	const centerText = centerParts.join(' · ');

	return (
		<Box flexDirection="row" justifyContent="space-between" paddingX={2}>
			<Text dimColor>{cwdShort}</Text>
			<Text dimColor>{centerText}</Text>
			<Text dimColor>
				/status{'  '}v{state.version}
			</Text>
		</Box>
	);
}
