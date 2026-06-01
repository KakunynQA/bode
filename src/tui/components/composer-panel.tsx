import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import {
	createComposerState,
	reduceComposer,
	composerText,
	composerIsEmpty,
	type ComposerState,
} from '../composer.ts';

const PLACEHOLDER = 'Ask Bode to plan, build, review, or ship something...';
const PEACH = '#FAB283';

type Props = {
	metadata: string;
	onSubmit: (text: string) => void;
	onTerminate: () => void;
	onOpenPalette: () => void;
	onLeaderKey: () => void;
};

export function ComposerPanel({
	metadata,
	onSubmit,
	onTerminate,
	onOpenPalette,
	onLeaderKey,
}: Props): JSX.Element {
	const [state, setState] = useState<ComposerState>(createComposerState());

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			onTerminate();
			return;
		}
		if (key.ctrl && input === 'p') {
			onOpenPalette();
			return;
		}
		if (key.ctrl && input === 'x') {
			onLeaderKey();
			return;
		}
		if (key.return && !key.shift) {
			const text = composerText(state);
			if (!text.trim()) return;
			setState(createComposerState());
			onSubmit(text);
			return;
		}
		if (key.return && key.shift) {
			setState((s) => reduceComposer(s, { kind: 'newline' }));
			return;
		}
		if (key.escape) {
			if (!composerIsEmpty(state)) {
				setState(createComposerState());
			}
			return;
		}
		if (key.backspace || key.delete) {
			setState((s) => reduceComposer(s, { kind: key.backspace ? 'backspace' : 'delete' }));
			return;
		}
		if (key.leftArrow) {
			setState((s) => reduceComposer(s, { kind: 'left' }));
			return;
		}
		if (key.rightArrow) {
			setState((s) => reduceComposer(s, { kind: 'right' }));
			return;
		}
		if (key.upArrow) {
			setState((s) => reduceComposer(s, { kind: 'up' }));
			return;
		}
		if (key.downArrow) {
			setState((s) => reduceComposer(s, { kind: 'down' }));
			return;
		}
		if (input && !key.ctrl && !key.meta) {
			const code = input.charCodeAt(0);
			if (code < 32 && input !== '\n' && input !== '\r') return;
			setState((s) => reduceComposer(s, { kind: 'char', value: input }));
		}
	});

	const isEmpty = composerIsEmpty(state);

	return (
		<Box flexDirection="column" paddingX={2}>
			<Box flexDirection="row" borderStyle="round" borderColor={PEACH} paddingX={1}>
				<Box flexDirection="column" flexGrow={1}>
					{isEmpty ? (
						<Box>
							<Text color={PEACH}>{'\u2503'}</Text>
							<Text dimColor>{PLACEHOLDER}</Text>
						</Box>
					) : (
						state.lines.map((line, i) => {
							const isCurrent = i === state.cursorLine;
							const col = isCurrent ? state.cursorCol : line.length;
							const before = line.slice(0, col);
							const at = line[col] ?? ' ';
							const after = line.slice(col + 1);
							return (
								<Box key={i}>
									<Text color={PEACH}>{'\u2503'}</Text>
									{isCurrent ? (
										<>
											<Text>{before}</Text>
											<Text inverse>{at}</Text>
											<Text>{after}</Text>
										</>
									) : (
										<Text>{line}</Text>
									)}
								</Box>
							);
						})
					)}
				</Box>
			</Box>
			<Box marginTop={0}>
				<Text dimColor>
					{'  '}
					{metadata}
				</Text>
				<Text dimColor>
					{'          '}
					tab complete{'  '}ctrl+p commands
				</Text>
			</Box>
		</Box>
	);
}
