import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { ghostCompletion } from '../completion.ts';

function stripControlChars(s: string): string {
	let out = '';
	for (const ch of s) {
		const code = ch.charCodeAt(0);
		if (code >= 32) out += ch;
	}
	return out;
}

type Props = {
	history: string[];
	onSubmit: (value: string) => void;
	onTerminate: () => void;
};

/**
 * Idle TUI prompt. Owns its own key handling via Ink's `useInput`:
 *   - Ctrl+C → onTerminate (Phase 2 contract)
 *   - ↑/↓ history navigation (Phase 3)
 *   - Tab accepts the inline ghost suggestion (Phase 4 — Claude-style)
 *   - ESC clears the in-progress command (v2.1.2)
 *
 * Single-line buffer with a flat string + integer cursor. Long pasted
 * commands wrap visually; the model stays flat.
 *
 * Inline ghost: as the user types, the next-matching subcommand/flag is
 * appended dimmed after the buffer. The first character of the ghost
 * carries the inverse-caret. When the cursor is mid-buffer (editing), the
 * ghost is hidden and the caret falls back to the character at the cursor.
 */
export function PromptInput({ history, onSubmit, onTerminate }: Props): JSX.Element {
	const [buffer, setBuffer] = useState('');
	const [cursor, setCursor] = useState(0);
	const [historyIdx, setHistoryIdx] = useState(history.length);
	const [draft, setDraft] = useState('');

	const ghost = ghostCompletion(buffer, cursor);

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			onTerminate();
			return;
		}
		// Ink's useInput does not always fire `key.escape` for a standalone
		// ESC press — across terminals + Node versions the raw ESC byte (0x1B)
		// sometimes lands in `input` instead. Accept both forms. We do NOT
		// match on `input === ''` because Ink also fires that for arrow /
		// function keys.
		const isEscape = key.escape || (input.length === 1 && input.charCodeAt(0) === 0x1b);
		if (isEscape) {
			if (buffer.length === 0 && historyIdx === history.length && draft === '') return;
			setBuffer('');
			setCursor(0);
			setHistoryIdx(history.length);
			setDraft('');
			return;
		}
		if (key.return) {
			const submitted = buffer;
			setBuffer('');
			setCursor(0);
			setHistoryIdx(history.length);
			setDraft('');
			onSubmit(submitted);
			return;
		}
		if (key.upArrow) {
			if (history.length === 0) return;
			const newIdx = Math.max(0, historyIdx - 1);
			if (newIdx === historyIdx) return;
			if (historyIdx === history.length) setDraft(buffer);
			const entry = history[newIdx] ?? '';
			setHistoryIdx(newIdx);
			setBuffer(entry);
			setCursor(entry.length);
			return;
		}
		if (key.downArrow) {
			if (historyIdx === history.length) return;
			const newIdx = historyIdx + 1;
			setHistoryIdx(newIdx);
			if (newIdx === history.length) {
				setBuffer(draft);
				setCursor(draft.length);
			} else {
				const entry = history[newIdx] ?? '';
				setBuffer(entry);
				setCursor(entry.length);
			}
			return;
		}
		if (key.leftArrow) {
			if (cursor > 0) setCursor(cursor - 1);
			return;
		}
		if (key.rightArrow) {
			if (cursor < buffer.length) setCursor(cursor + 1);
			return;
		}
		if (key.delete || key.backspace) {
			if (cursor === 0) return;
			setBuffer(buffer.slice(0, cursor - 1) + buffer.slice(cursor));
			setCursor(cursor - 1);
			return;
		}
		if (key.tab) {
			if (ghost) {
				const next = buffer + ghost;
				setBuffer(next);
				setCursor(next.length);
			}
			return;
		}
		if (input && !key.ctrl && !key.meta) {
			const safe = stripControlChars(input);
			if (!safe) return;
			setBuffer(buffer.slice(0, cursor) + safe + buffer.slice(cursor));
			setCursor(cursor + safe.length);
		}
	});

	const atEnd = cursor === buffer.length;
	return (
		<Box paddingX={1}>
			<Text color="cyan">{'> '}</Text>
			{atEnd ? (
				<>
					<Text>{buffer}</Text>
					{ghost ? (
						<>
							<Text inverse dimColor>
								{ghost[0]}
							</Text>
							<Text dimColor>{ghost.slice(1)}</Text>
						</>
					) : (
						<Text inverse> </Text>
					)}
				</>
			) : (
				<>
					<Text>{buffer.slice(0, cursor)}</Text>
					<Text inverse>{buffer[cursor] ?? ' '}</Text>
					<Text>{buffer.slice(cursor + 1)}</Text>
				</>
			)}
		</Box>
	);
}
