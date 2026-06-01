import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import {
	createPaletteState,
	reducePalette,
	selectedCommand,
	type PaletteState,
	PALETTE_COMMANDS,
} from '../palette.ts';

const PEACH = '#FAB283';
const PURPLE = '#9D7CD8';
type Props = {
	onClose: () => void;
	onSelect: (commandId: string) => void;
	commands?: typeof PALETTE_COMMANDS;
};

export function CommandPalette({ onClose, onSelect, commands }: Props): JSX.Element {
	const [state, setState] = useState<PaletteState>(() => createPaletteState(commands));

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
				onSelect(cmd.id);
			}
			return;
		}
		if (key.backspace) {
			setState((s) => reducePalette(s, { kind: 'type', value: s.query.slice(0, -1) }));
			return;
		}
		if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
			const code = input.charCodeAt(0);
			if (code < 32) return;
			setState((s) => reducePalette(s, { kind: 'type', value: s.query + input }));
		}
	});

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginX={4}>
			<Box marginBottom={1}>
				<Text bold>Commands</Text>
				<Text dimColor>{'                                              '}esc</Text>
			</Box>
			<Box marginBottom={1}>
				<Text color="cyan">{'> '}</Text>
				<Text>{state.query}</Text>
				<Text inverse> </Text>
			</Box>
			{state.categories.map((cat) => {
				const catItems = state.filtered.filter((item) => item.category === cat);
				if (catItems.length === 0) return null;
				return (
					<Box key={cat} flexDirection="column" marginBottom={1}>
						<Text color={PURPLE} bold>
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
		</Box>
	);
}
