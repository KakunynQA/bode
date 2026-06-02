import { Box, Text, useInput } from 'ink';
import {
	reduceComposer,
	composerText,
	composerIsEmpty,
	linearCursorOffset,
	type ComposerState,
} from '../composer.ts';
import { ghostCompletion } from '../completion.ts';

const PLACEHOLDER = 'Ask Bode to plan, build, review, or ship something...';
const PEACH = '#FAB283';

type Props = {
	state: ComposerState;
	onChange: (next: ComposerState) => void;
	onSubmit: (text: string) => void;
	onTerminate: () => void;
	onOpenPalette: () => void;
	onLeaderKey: () => void;
	disabled?: boolean;
	active?: boolean;
};

export function ComposerPanel({
	state,
	onChange,
	onSubmit,
	onTerminate,
	onOpenPalette,
	onLeaderKey,
	disabled,
	active = true,
}: Props): JSX.Element {
	useInput(
		(input, key) => {
			if (disabled || !active) return;

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

			if (key.ctrl && input === 'a') {
				onChange(reduceComposer(state, { kind: 'home' }));
				return;
			}
			if (key.ctrl && input === 'e') {
				onChange(reduceComposer(state, { kind: 'end' }));
				return;
			}
			if (key.ctrl && input === 'b') {
				onChange(reduceComposer(state, { kind: 'left' }));
				return;
			}
			if (key.ctrl && input === 'f') {
				onChange(reduceComposer(state, { kind: 'right' }));
				return;
			}
			if (key.ctrl && input === 'u') {
				onChange(reduceComposer(state, { kind: 'killToStart' }));
				return;
			}
			if (key.ctrl && input === 'k') {
				onChange(reduceComposer(state, { kind: 'killLine' }));
				return;
			}
			if (key.ctrl && input === 'w') {
				onChange(reduceComposer(state, { kind: 'deleteWord' }));
				return;
			}

			if (key.tab) {
				const text = composerText(state);
				const offset = linearCursorOffset(state);
				const ghost = ghostCompletion(text, offset);
				if (ghost) {
					onChange(reduceComposer(state, { kind: 'char', value: ghost }));
				}
				return;
			}

			if (key.return && !key.shift) {
				const text = composerText(state);
				if (!text.trim()) return;
				onChange(reduceComposer(state, { kind: 'clear' }));
				onSubmit(text);
				return;
			}
			if (key.return && key.shift) {
				onChange(reduceComposer(state, { kind: 'newline' }));
				return;
			}
			if (key.escape) {
				if (!composerIsEmpty(state)) {
					onChange(reduceComposer(state, { kind: 'clear' }));
				}
				return;
			}

			const isRawBackspace = input === '\x7f' || input === '\b';
			if (key.backspace || isRawBackspace) {
				onChange(reduceComposer(state, { kind: 'backspace' }));
				return;
			}
			if (key.delete) {
				onChange(reduceComposer(state, { kind: 'delete' }));
				return;
			}

			if (key.leftArrow) {
				onChange(reduceComposer(state, { kind: 'left' }));
				return;
			}
			if (key.rightArrow) {
				onChange(reduceComposer(state, { kind: 'right' }));
				return;
			}
			if (key.upArrow) {
				onChange(reduceComposer(state, { kind: 'up' }));
				return;
			}
			if (key.downArrow) {
				onChange(reduceComposer(state, { kind: 'down' }));
				return;
			}

			if (key.ctrl && (input === 'j' || input === 'n' || input === 'm')) {
				onChange(reduceComposer(state, { kind: 'newline' }));
				return;
			}

			if (input && !key.ctrl && !key.meta) {
				const code = input.charCodeAt(0);
				if (code < 32 && input !== '\n' && input !== '\r') return;
				onChange(reduceComposer(state, { kind: 'char', value: input }));
			}
		},
		{ isActive: !disabled && active }
	);

	const isEmpty = composerIsEmpty(state);
	const text = composerText(state);
	const offset = linearCursorOffset(state);
	const ghost = ghostCompletion(text, offset);

	return (
		<Box flexDirection="column" paddingX={1} borderStyle="round" borderColor={PEACH}>
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
						const isLastLine = i === state.lines.length - 1;
						const showGhost = isCurrent && isLastLine && ghost;
						return (
							<Box key={i}>
								<Text color={PEACH}>{'\u2503'}</Text>
								{isCurrent ? (
									<>
										<Text>{before}</Text>
										<Text inverse>{at}</Text>
										<Text>{after}</Text>
										{showGhost && <Text dimColor>{ghost}</Text>}
									</>
								) : (
									<Text>{line}</Text>
								)}
							</Box>
						);
					})
				)}
			</Box>
			<Box marginTop={0}>
				<Text dimColor>
					{'  '}
					{disabled ? 'running...' : 'tab complete  \u2502  ctrl+p commands'}
				</Text>
			</Box>
		</Box>
	);
}
