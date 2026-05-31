import { Box } from 'ink';
import { Header } from './header.tsx';
import { Footer } from './footer.tsx';
import { PromptInput } from './prompt-input.tsx';
import type { ShellState } from '../state.ts';

type Props = {
	state: ShellState;
	lastExitCode: number | null;
	history: string[];
	onSubmit: (value: string) => void;
	onTerminate: () => void;
};

export function App({ state, lastExitCode, history, onSubmit, onTerminate }: Props): JSX.Element {
	return (
		<Box flexDirection="column">
			<Header state={state} />
			<PromptInput history={history} onSubmit={onSubmit} onTerminate={onTerminate} />
			<Footer state={state} lastExitCode={lastExitCode} />
		</Box>
	);
}
