import { Box, Text } from 'ink';
import type { ShellState } from '../state.ts';

type Props = {
	state: ShellState;
};

export function Header({ state }: Props): JSX.Element {
	const projectLabel = state.project
		? `${state.project.name} (${state.project.trackerKind})`
		: 'no project configured';

	return (
		<Box
			borderStyle="round"
			borderColor="cyan"
			paddingX={1}
			flexDirection="row"
			justifyContent="space-between"
		>
			<Text>
				<Text color="cyan" bold>
					bode
				</Text>{' '}
				<Text dimColor>v{state.version}</Text>
			</Text>
			<Text>
				<Text dimColor>project </Text>
				<Text color={state.project ? 'green' : 'yellow'}>{projectLabel}</Text>
			</Text>
		</Box>
	);
}
