import { Box, Text } from 'ink';
import type { ShellState } from '../state.ts';

type Props = {
	state: ShellState;
};

export function StatusBar({ state }: Props): JSX.Element {
	const cwd = state.project?.workdir ?? process.cwd();
	const cwdShort = cwd.split(/[/\\]/).slice(-2).join('/');

	const trackerLabel = state.project?.trackerKind ?? 'local';
	const centerParts: string[] = [];
	if (trackerLabel) centerParts.push(trackerLabel);
	if (state.activeRun) {
		centerParts.push(state.activeRun.key);
		centerParts.push(state.activeRun.phase);
	}
	const centerText = centerParts.join(' \u00B7 ');

	return (
		<Box flexDirection="row" justifyContent="space-between" paddingX={2}>
			<Text dimColor>{cwdShort}</Text>
			<Text dimColor>{centerText}</Text>
			<Text dimColor>{'v' + state.version}</Text>
		</Box>
	);
}
