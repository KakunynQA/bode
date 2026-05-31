import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { completeBuffer } from '../completion.ts';

function stripControlChars(s: string): string {
	let out = '';
	for (const ch of s) {
		const code = ch.charCodeAt(0);
		if (code >= 32) out += ch; // drop all control bytes including tab (tab is handled separately)
	}
	return out;
}

type Props = {
	history: string[];
	onSubmit: (value: string) => void;
	onTerminate: () => void;
};

/**
 * Idle TUI prompt. Owns its own key handling via Ink's `useInput` so we can:
 *   - intercept Ctrl+C and signal up via `onTerminate` (Phase 2 contract)
 *   - drive ↑/↓ history navigation (Phase 3)
 *   - host Tab autocomplete in Phase 4 (not wired here yet)
 *
 * The buffer is single-line and uses a flat string with an integer cursor.
 * Long pastes wrap visually in the terminal; the editor model stays flat.
 */
export function PromptInput({ history, onSubmit, onTerminate }: Props): JSX.Element {
	const [buffer, setBuffer] = useState('');
	const [cursor, setCursor] = useState(0);
	// history index: 0 .. history.length. The `history.length` value means
	// "current draft, not in history yet". Decrementing to history.length - 1
	// shows the most recent entry; 0 shows the oldest.
	const [historyIdx, setHistoryIdx] = useState(history.length);
	// Saved draft so ↓ past the newest history entry restores in-progress text.
	const [draft, setDraft] = useState('');

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			onTerminate();
			return;
		}
		if (key.return) {
			const submitted = buffer;
			setBuffer('');
			setCursor(0);
			setHistoryIdx(history.length); // reset for the next prompt
			setDraft('');
			onSubmit(submitted);
			return;
		}
		if (key.upArrow) {
			if (history.length === 0) return;
			const newIdx = Math.max(0, historyIdx - 1);
			if (newIdx === historyIdx) return;
			// On first ↑ press, stash the in-progress draft so ↓ can restore it.
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
			const result = completeBuffer(buffer, cursor);
			if (result.kind === 'insert') {
				setBuffer(result.buffer);
				setCursor(result.cursor);
			} else if (result.kind === 'candidates') {
				// Print candidates above the Ink prompt. Ink re-renders the
				// component, which keeps the buffer visible underneath.
				process.stdout.write('\n  ' + result.candidates.join('  ') + '\n');
			}
			return;
		}
		// Printable insertion. Filter out control bytes — anything below space.
		if (input && !key.ctrl && !key.meta) {
			const safe = stripControlChars(input);
			if (!safe) return;
			setBuffer(buffer.slice(0, cursor) + safe + buffer.slice(cursor));
			setCursor(cursor + safe.length);
		}
	});

	const before = buffer.slice(0, cursor);
	const at = buffer[cursor] ?? ' ';
	const after = buffer.slice(cursor + 1);

	return (
		<Box paddingX={1}>
			<Text color="cyan">{'> '}</Text>
			<Text>{before}</Text>
			<Text inverse>{at}</Text>
			<Text>{after}</Text>
		</Box>
	);
}
