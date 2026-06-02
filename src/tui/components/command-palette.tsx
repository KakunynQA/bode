import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import {
	createPaletteState,
	reducePalette,
	selectedCommand,
	type PaletteState,
} from '../palette.ts';

const PEACH = '#FAB283';
const PURPLE = '#9D7CD8';

type Props = {
	onClose: () => void;
	onSelectInsert: (insertText: string) => void;
	termCols?: number;
};

export function CommandPalette({ onClose, onSelectInsert, termCols }: Props): JSX.Element {
	const cols = termCols ?? process.stdout.columns ?? 80;
	const panelWidth = Math.min(60, cols - 4);
	const marginLeft = Math.max(0, Math.floor((cols - panelWidth) / 2) - 2);

	const [state, setState] = useState<PaletteState>(() => createPaletteState());

	useInput((input, key) => {
		if (key.escape) {
			onClose();
			return;
		}
		if (key.upArrow) {
			setState((s) => reducePalette(s, { kind: 'up' }));
			return;
		}
		if (key.downArrow) {
			setState((s) => reducePalette(s, { kind: 'down' }));
			return;
		}
		if (key.return) {
			const cmd = selectedCommand(state);
			if (cmd) {
				onSelectInsert(cmd.insertText);
			}
			return;
		}
		if (key.backspace || input === '\x7f' || input === '\b') {
			setState((s) => reducePalette(s, { kind: 'type', value: s.query.slice(0, -1) }));
			return;
		}
		if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
			const code = input.charCodeAt(0);
			if (code < 32) return;
			setState((s) => reducePalette(s, { kind: 'type', value: s.query + input }));
		}
	});

	const maxVisible = 8;
	const visibleStart = state.cursor >= maxVisible ? state.cursor - maxVisible + 1 : 0;
	const visibleItems = state.filtered.slice(visibleStart, visibleStart + maxVisible);

	return (
		<Box flexDirection="column" marginLeft={marginLeft}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				width={panelWidth}
			>
				<Box marginBottom={1}>
					<Text bold color={PURPLE}>
						{'Commands'}
					</Text>
					<Text dimColor>{'  '}esc to close</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color="cyan">{'> '}</Text>
					<Text>{state.query}</Text>
					<Text inverse> </Text>
				</Box>
				{state.categories.map((cat) => {
					const catItems = visibleItems.filter((item) => item.category === cat);
					if (catItems.length === 0) return null;
					return (
						<Box key={cat} flexDirection="column" marginBottom={1}>
							<Text color={PURPLE} bold dimColor>
								{cat}
							</Text>
							{catItems.map((item) => {
								const idx = state.filtered.indexOf(item);
								const isSelected = idx === state.cursor;
								return (
									<Box key={item.id} flexDirection="row" justifyContent="space-between">
										{isSelected ? (
											<Text backgroundColor={PEACH} color="black" bold>
												{' ' + item.label + ' '}
											</Text>
										) : (
											<Text>{'  ' + item.label}</Text>
										)}
										{item.shortcut ? <Text dimColor>{item.shortcut}</Text> : null}
									</Box>
								);
							})}
						</Box>
					);
				})}
				{state.filtered.length === 0 && <Text dimColor>{'  No matching commands'}</Text>}
			</Box>
		</Box>
	);
}
