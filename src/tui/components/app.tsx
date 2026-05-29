import { Box } from 'ink';
import { Header } from './header.tsx';
import { Footer } from './footer.tsx';
import { PromptInput } from './prompt-input.tsx';
import type { ShellState } from '../state.ts';

type Props = {
	state: ShellState;
	lastExitCode: number | null;
	onSubmit: (value: string) => void;
};

export function App({ state, lastExitCode, onSubmit }: Props): JSX.Element {
	return (
		<Box flexDirection="column">
			<Header state={state} />
			<PromptInput onSubmit={onSubmit} />
			<Footer state={state} lastExitCode={lastExitCode} />
		</Box>
	);
}
