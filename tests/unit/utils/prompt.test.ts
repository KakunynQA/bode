import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	CancelledError,
	TerminateShellError,
	AT_TRIGGER,
	Separator,
	__testing,
	type PromptState,
	type InputPromptState,
	type KeyEvent,
} from '~/utils/prompt.ts';

const {
	reduceKeystroke,
	reduceInputState,
	reduceSelectState,
	reduceSearchState,
	parseChunk,
	clampCursor,
} = __testing;

const empty: PromptState = { buffer: '', cursor: 0 };
const abc: PromptState = { buffer: 'abc', cursor: 3 };
const abcMid: PromptState = { buffer: 'abc', cursor: 1 };

const emptyInput: InputPromptState = { buffer: '', cursor: 0 };
const abcInput: InputPromptState = { buffer: 'abc', cursor: 3 };

function feed(state: PromptState, keys: KeyEvent[]): PromptState {
	let s = state;
	for (const k of keys) s = reduceKeystroke(s, k);
	return s;
}

function _feedInput(state: InputPromptState, keys: KeyEvent[]): InputPromptState {
	let s = state;
	for (const k of keys) s = reduceInputState(s, k);
	return s;
}
void _feedInput;

// ---------------------------------------------------------------------------
// Error classes and sentinels
// ---------------------------------------------------------------------------

describe('CancelledError', () => {
	it('is an Error subclass with name "CancelledError"', () => {
		const err = new CancelledError();
		assert.ok(err instanceof Error);
		assert.equal(err.name, 'CancelledError');
		assert.equal(err.message, '__CANCELLED__');
	});
});

describe('TerminateShellError', () => {
	it('is an Error subclass with name "TerminateShellError"', () => {
		const err = new TerminateShellError();
		assert.ok(err instanceof Error);
		assert.equal(err.name, 'TerminateShellError');
		assert.equal(err.message, '__TERMINATE_SHELL__');
	});
});

describe('AT_TRIGGER sentinel', () => {
	it('is a unique symbol', () => {
		assert.equal(typeof AT_TRIGGER, 'symbol');
		assert.equal(AT_TRIGGER === AT_TRIGGER, true);
	});
});

describe('Separator', () => {
	it('has a default name', () => {
		const sep = new Separator();
		assert.equal(sep.name, '────────');
	});
	it('accepts custom name', () => {
		const sep = new Separator('---');
		assert.equal(sep.name, '---');
	});
});

// ---------------------------------------------------------------------------
// reduceKeystroke (askInputWithAtTrigger)
// ---------------------------------------------------------------------------

describe('reduceKeystroke', () => {
	it('inserts a printable char at cursor', () => {
		const next = reduceKeystroke(empty, { kind: 'char', value: 'a' });
		assert.deepEqual(next, { buffer: 'a', cursor: 1 });
	});

	it('inserts a printable char at mid-cursor', () => {
		const next = reduceKeystroke(abcMid, { kind: 'char', value: 'X' });
		assert.deepEqual(next, { buffer: 'aXbc', cursor: 2 });
	});

	it('typing then Backspace returns to empty', () => {
		const next = feed(empty, [{ kind: 'char', value: 'a' }, { kind: 'backspace' }]);
		assert.deepEqual(next, { buffer: '', cursor: 0 });
	});

	it('Backspace at cursor 0 is a no-op', () => {
		const next = reduceKeystroke(empty, { kind: 'backspace' });
		assert.deepEqual(next, empty);
	});

	it('Backspace removes char before cursor in middle', () => {
		const next = reduceKeystroke({ buffer: 'abc', cursor: 2 }, { kind: 'backspace' });
		assert.deepEqual(next, { buffer: 'ac', cursor: 1 });
	});

	it('Delete at cursor 0 removes first char', () => {
		const next = reduceKeystroke({ buffer: 'abc', cursor: 0 }, { kind: 'delete' });
		assert.deepEqual(next, { buffer: 'bc', cursor: 0 });
	});

	it('Delete at end of buffer is a no-op', () => {
		const next = reduceKeystroke(abc, { kind: 'delete' });
		assert.deepEqual(next, abc);
	});

	it('Left arrow decrements cursor', () => {
		const next = reduceKeystroke(abc, { kind: 'left' });
		assert.deepEqual(next, { buffer: 'abc', cursor: 2 });
	});

	it('Left arrow at cursor 0 is a no-op', () => {
		const next = reduceKeystroke(empty, { kind: 'left' });
		assert.deepEqual(next, empty);
	});

	it('Right arrow increments cursor', () => {
		const next = reduceKeystroke({ buffer: 'abc', cursor: 0 }, { kind: 'right' });
		assert.deepEqual(next, { buffer: 'abc', cursor: 1 });
	});

	it('Right arrow at cursor === length is a no-op', () => {
		const next = reduceKeystroke(abc, { kind: 'right' });
		assert.deepEqual(next, abc);
	});

	it('Home moves cursor to 0', () => {
		const next = reduceKeystroke(abc, { kind: 'home' });
		assert.deepEqual(next, { buffer: 'abc', cursor: 0 });
	});

	it('End moves cursor to buffer length', () => {
		const next = reduceKeystroke({ buffer: 'abc', cursor: 0 }, { kind: 'end' });
		assert.deepEqual(next, { buffer: 'abc', cursor: 3 });
	});

	it('Up arrow is a no-op', () => {
		const next = reduceKeystroke(abc, { kind: 'up' });
		assert.deepEqual(next, abc);
	});

	it('Down arrow is a no-op', () => {
		const next = reduceKeystroke(abc, { kind: 'down' });
		assert.deepEqual(next, abc);
	});

	it('@ keypress returns exit=AT_TRIGGER and does not mutate buffer', () => {
		const next = reduceKeystroke({ buffer: 'foo', cursor: 3 }, { kind: 'at' });
		assert.deepEqual(next, { buffer: 'foo', cursor: 3, exit: 'AT_TRIGGER' });
	});

	it('Enter returns exit=DONE with the current buffer', () => {
		const next = reduceKeystroke({ buffer: 'hello', cursor: 5 }, { kind: 'enter' });
		assert.deepEqual(next, { buffer: 'hello', cursor: 5, exit: 'DONE' });
	});

	it('Ctrl+C returns exit=CANCELLED', () => {
		const next = reduceKeystroke(abc, { kind: 'ctrlC' });
		assert.deepEqual(next, { ...abc, exit: 'CANCELLED' });
	});

	it('keystrokes after exit are ignored', () => {
		const stopped = reduceKeystroke(abc, { kind: 'enter' });
		const next = reduceKeystroke(stopped, { kind: 'char', value: 'X' });
		assert.deepEqual(next, stopped);
	});
});

// ---------------------------------------------------------------------------
// reduceInputState (askInput)
// ---------------------------------------------------------------------------

describe('reduceInputState', () => {
	it('inserts a printable char at cursor', () => {
		const next = reduceInputState(emptyInput, { kind: 'char', value: 'a' });
		assert.equal(next.buffer, 'a');
		assert.equal(next.cursor, 1);
		assert.equal(next.exit, undefined);
	});

	it('@ is treated as a regular char (not a trigger)', () => {
		const next = reduceInputState(emptyInput, { kind: 'at' });
		assert.equal(next.buffer, '@');
		assert.equal(next.cursor, 1);
	});

	it('Enter returns exit=DONE', () => {
		const next = reduceInputState(abcInput, { kind: 'enter' });
		assert.equal(next.buffer, 'abc');
		assert.equal(next.cursor, 3);
		assert.equal(next.exit, 'DONE');
	});

	it('Ctrl+C returns exit=CANCELLED', () => {
		const next = reduceInputState(abcInput, { kind: 'ctrlC' });
		assert.equal(next.buffer, 'abc');
		assert.equal(next.cursor, 3);
		assert.equal(next.exit, 'CANCELLED');
	});

	it('Up and Down are no-ops', () => {
		const up = reduceInputState(abcInput, { kind: 'up' });
		assert.equal(up.cursor, 3);
		assert.equal(up.buffer, 'abc');
		assert.equal(up.exit, undefined);
		const down = reduceInputState(abcInput, { kind: 'down' });
		assert.equal(down.cursor, 3);
		assert.equal(down.buffer, 'abc');
		assert.equal(down.exit, undefined);
	});

	it('Backspace at cursor 0 is a no-op', () => {
		const next = reduceInputState(emptyInput, { kind: 'backspace' });
		assert.equal(next.buffer, '');
		assert.equal(next.cursor, 0);
	});

	it('Delete at end is a no-op', () => {
		const next = reduceInputState(abcInput, { kind: 'delete' });
		assert.equal(next.buffer, 'abc');
		assert.equal(next.cursor, 3);
	});

	it('Left/Right/Home/End move cursor', () => {
		const left = reduceInputState(abcInput, { kind: 'left' });
		assert.equal(left.cursor, 2);
		assert.equal(left.buffer, 'abc');

		const right = reduceInputState({ buffer: 'abc', cursor: 0 }, { kind: 'right' });
		assert.equal(right.cursor, 1);
		assert.equal(right.buffer, 'abc');

		const home = reduceInputState(abcInput, { kind: 'home' });
		assert.equal(home.cursor, 0);
		assert.equal(home.buffer, 'abc');

		const end = reduceInputState({ buffer: 'abc', cursor: 0 }, { kind: 'end' });
		assert.equal(end.cursor, 3);
		assert.equal(end.buffer, 'abc');
	});

	it('keystrokes after exit are ignored', () => {
		const stopped = reduceInputState(abcInput, { kind: 'enter' });
		const next = reduceInputState(stopped, { kind: 'char', value: 'X' });
		assert.deepEqual(next, stopped);
	});
});

// ---------------------------------------------------------------------------
// reduceSelectState (askSelect)
// ---------------------------------------------------------------------------

describe('reduceSelectState', () => {
	type S = SelectItem<{ label: string }>;
	type SelState = ReturnType<typeof reduceSelectState<S>>;

	const items: S[] = [
		{ name: 'Alpha', value: { label: 'a' } },
		{ name: 'Beta', value: { label: 'b' } },
		{ name: 'Gamma', value: { label: 'g' } },
	];

	function makeState(cursor = 0): SelState {
		return { items, cursor, scrollOffset: 0, pageSize: 7 };
	}

	it('Down moves cursor down', () => {
		const next = reduceSelectState(makeState(0), { kind: 'down' });
		assert.equal(next.cursor, 1);
	});

	it('Up moves cursor up', () => {
		const next = reduceSelectState(makeState(1), { kind: 'up' });
		assert.equal(next.cursor, 0);
	});

	it('Down at last item is a no-op', () => {
		const next = reduceSelectState(makeState(2), { kind: 'down' });
		assert.equal(next.cursor, 2);
	});

	it('Up at first item is a no-op', () => {
		const next = reduceSelectState(makeState(0), { kind: 'up' });
		assert.equal(next.cursor, 0);
	});

	it('Enter selects current item', () => {
		const next = reduceSelectState(makeState(1), { kind: 'enter' });
		assert.equal(next.exit, 'DONE');
	});

	it('Ctrl+C returns CANCELLED', () => {
		const next = reduceSelectState(makeState(0), { kind: 'ctrlC' });
		assert.equal(next.exit, 'CANCELLED');
	});

	it('Char keys are no-ops', () => {
		const next = reduceSelectState(makeState(1), { kind: 'char', value: 'a' });
		assert.equal(next.cursor, 1);
		assert.equal(next.exit, undefined);
	});

	it('skips disabled items on down', () => {
		const withDisabled: S[] = [
			{ name: 'A', value: { label: 'a' } },
			{ name: 'B', value: { label: 'b' }, disabled: true },
			{ name: 'C', value: { label: 'c' } },
		];
		const state = { items: withDisabled, cursor: 0, scrollOffset: 0, pageSize: 7 };
		const next = reduceSelectState(state, { kind: 'down' });
		assert.equal(next.cursor, 2);
	});

	it('skips disabled items on up', () => {
		const withDisabled: S[] = [
			{ name: 'A', value: { label: 'a' } },
			{ name: 'B', value: { label: 'b' }, disabled: true },
			{ name: 'C', value: { label: 'c' } },
		];
		const state = { items: withDisabled, cursor: 2, scrollOffset: 0, pageSize: 7 };
		const next = reduceSelectState(state, { kind: 'up' });
		assert.equal(next.cursor, 0);
	});

	it('Enter on disabled item is a no-op', () => {
		const withDisabled: S[] = [
			{ name: 'A', value: { label: 'a' } },
			{ name: 'B', value: { label: 'b' }, disabled: true },
		];
		const state = { items: withDisabled, cursor: 1, scrollOffset: 0, pageSize: 7 };
		const next = reduceSelectState(state, { kind: 'enter' });
		assert.equal(next.exit, undefined);
	});

	it('scrollOffset adjusts when cursor moves below visible window', () => {
		const manyItems: S[] = Array.from({ length: 20 }, (_, i) => ({
			name: `Item ${i}`,
			value: { label: String(i) },
		}));
		const state = { items: manyItems, cursor: 6, scrollOffset: 0, pageSize: 7 };
		const next = reduceSelectState(state, { kind: 'down' });
		assert.equal(next.cursor, 7);
		assert.equal(next.scrollOffset, 1);
	});

	it('scrollOffset adjusts when cursor moves above visible window', () => {
		const manyItems: S[] = Array.from({ length: 20 }, (_, i) => ({
			name: `Item ${i}`,
			value: { label: String(i) },
		}));
		const state = { items: manyItems, cursor: 3, scrollOffset: 3, pageSize: 7 };
		const next = reduceSelectState(state, { kind: 'up' });
		assert.equal(next.cursor, 2);
		assert.equal(next.scrollOffset, 2);
	});

	it('keystrokes after exit are ignored', () => {
		const stopped = reduceSelectState(makeState(0), { kind: 'enter' });
		const next = reduceSelectState(stopped, { kind: 'down' });
		assert.deepEqual(next, stopped);
	});
});

type SelectItem<T> = { name: string; value: T; description?: string; disabled?: boolean };

// ---------------------------------------------------------------------------
// reduceSearchState (askSearch)
// ---------------------------------------------------------------------------

describe('reduceSearchState', () => {
	type Sc = { name: string; value: number };
	const items: Sc[] = [
		{ name: 'file1.ts', value: 1 },
		{ name: 'file2.ts', value: 2 },
		{ name: 'file3.ts', value: 3 },
	];

	function makeSearch(buf = '', cursor = 0) {
		return {
			buffer: buf,
			inputCursor: cursor,
			items,
			listCursor: 0,
			scrollOffset: 0,
			pageSize: 7,
			loading: false,
			focusMode: 'input' as const,
		};
	}

	it('char adds to buffer', () => {
		const next = reduceSearchState(makeSearch(), { kind: 'char', value: 'a' });
		assert.equal(next.buffer, 'a');
		assert.equal(next.inputCursor, 1);
		assert.equal(next.focusMode, 'input');
		assert.equal(next.loading, true);
	});

	it('backspace removes char', () => {
		const next = reduceSearchState(makeSearch('ab', 2), { kind: 'backspace' });
		assert.equal(next.buffer, 'a');
		assert.equal(next.inputCursor, 1);
	});

	it('down switches to list focus', () => {
		const next = reduceSearchState(makeSearch(), { kind: 'down' });
		assert.equal(next.focusMode, 'list');
		assert.equal(next.listCursor, 0);
	});

	it('up switches to list focus', () => {
		const next = reduceSearchState(makeSearch(), { kind: 'up' });
		assert.equal(next.focusMode, 'list');
		assert.equal(next.listCursor, 0);
	});

	it('down in list mode moves listCursor', () => {
		const state = { ...makeSearch(), focusMode: 'list' as const, listCursor: 0 };
		const next = reduceSearchState(state, { kind: 'down' });
		assert.equal(next.listCursor, 1);
		assert.equal(next.focusMode, 'list');
	});

	it('up in list mode moves listCursor', () => {
		const state = { ...makeSearch(), focusMode: 'list' as const, listCursor: 2 };
		const next = reduceSearchState(state, { kind: 'up' });
		assert.equal(next.listCursor, 1);
	});

	it('enter in input mode selects first item', () => {
		const next = reduceSearchState(makeSearch(), { kind: 'enter' });
		assert.equal(next.exit, 'DONE');
	});

	it('enter in list mode selects item under cursor', () => {
		const state = { ...makeSearch(), focusMode: 'list' as const, listCursor: 1 };
		const next = reduceSearchState(state, { kind: 'enter' });
		assert.equal(next.exit, 'DONE');
	});

	it('ctrlC returns CANCELLED', () => {
		const next = reduceSearchState(makeSearch(), { kind: 'ctrlC' });
		assert.equal(next.exit, 'CANCELLED');
	});

	it('left/right move inputCursor', () => {
		const state = makeSearch('abc', 3);
		assert.equal(reduceSearchState(state, { kind: 'left' }).inputCursor, 2);
		assert.equal(reduceSearchState(makeSearch('abc', 0), { kind: 'right' }).inputCursor, 1);
	});

	it('home/end move inputCursor to bounds', () => {
		assert.equal(reduceSearchState(makeSearch('abc', 2), { kind: 'home' }).inputCursor, 0);
		assert.equal(reduceSearchState(makeSearch('abc', 0), { kind: 'end' }).inputCursor, 3);
	});

	it('@ is treated as a char', () => {
		const next = reduceSearchState(makeSearch(), { kind: 'at' });
		assert.equal(next.buffer, '@');
		assert.equal(next.inputCursor, 1);
		assert.equal(next.loading, true);
	});

	it('keystrokes after exit are ignored', () => {
		const stopped = reduceSearchState(makeSearch(), { kind: 'enter' });
		const next = reduceSearchState(stopped, { kind: 'char', value: 'a' });
		assert.deepEqual(next, stopped);
	});
});

// ---------------------------------------------------------------------------
// parseChunk
// ---------------------------------------------------------------------------

describe('parseChunk', () => {
	it('parses printable chars', () => {
		assert.deepEqual(parseChunk('abc'), [
			{ kind: 'char', value: 'a' },
			{ kind: 'char', value: 'b' },
			{ kind: 'char', value: 'c' },
		]);
	});

	it('recognises @ as the dedicated event', () => {
		assert.deepEqual(parseChunk('a@b'), [
			{ kind: 'char', value: 'a' },
			{ kind: 'at' },
			{ kind: 'char', value: 'b' },
		]);
	});

	it('parses Enter (\\r and \\n)', () => {
		assert.deepEqual(parseChunk('\r'), [{ kind: 'enter' }]);
		assert.deepEqual(parseChunk('\n'), [{ kind: 'enter' }]);
	});

	it('parses Backspace (0x7f and 0x08)', () => {
		assert.deepEqual(parseChunk('\x7f'), [{ kind: 'backspace' }]);
		assert.deepEqual(parseChunk('\x08'), [{ kind: 'backspace' }]);
	});

	it('parses Ctrl+C', () => {
		assert.deepEqual(parseChunk('\x03'), [{ kind: 'ctrlC' }]);
	});

	it('parses CSI arrow keys (all four)', () => {
		assert.deepEqual(parseChunk('\x1b[A'), [{ kind: 'up' }]);
		assert.deepEqual(parseChunk('\x1b[B'), [{ kind: 'down' }]);
		assert.deepEqual(parseChunk('\x1b[C'), [{ kind: 'right' }]);
		assert.deepEqual(parseChunk('\x1b[D'), [{ kind: 'left' }]);
	});

	it('parses Home / End / Delete (multiple CSI forms)', () => {
		assert.deepEqual(parseChunk('\x1b[H'), [{ kind: 'home' }]);
		assert.deepEqual(parseChunk('\x1b[1~'), [{ kind: 'home' }]);
		assert.deepEqual(parseChunk('\x1b[F'), [{ kind: 'end' }]);
		assert.deepEqual(parseChunk('\x1b[4~'), [{ kind: 'end' }]);
		assert.deepEqual(parseChunk('\x1b[3~'), [{ kind: 'delete' }]);
	});

	it('lone trailing ESC at end of chunk is dropped', () => {
		assert.deepEqual(parseChunk('a\x1b'), [{ kind: 'char', value: 'a' }]);
	});

	it('mid-chunk lone ESC is dropped (likely Alt-prefix)', () => {
		assert.deepEqual(parseChunk('\x1ba'), [{ kind: 'char', value: 'a' }]);
	});

	it('parses a paste containing @', () => {
		assert.deepEqual(parseChunk('foo@bar'), [
			{ kind: 'char', value: 'f' },
			{ kind: 'char', value: 'o' },
			{ kind: 'char', value: 'o' },
			{ kind: 'at' },
			{ kind: 'char', value: 'b' },
			{ kind: 'char', value: 'a' },
			{ kind: 'char', value: 'r' },
		]);
	});
});

// ---------------------------------------------------------------------------
// clampCursor
// ---------------------------------------------------------------------------

describe('clampCursor', () => {
	it('clamps cursor to valid range', () => {
		type T = { name: string; value: string };
		const items: T[] = [
			{ name: 'a', value: 'a' },
			{ name: 'b', value: 'b' },
		];
		const state = { items, cursor: 5, scrollOffset: 0, pageSize: 7 };
		const clamped = clampCursor(state);
		assert.equal(clamped.cursor, 1);
	});

	it('clamps negative cursor to 0', () => {
		type T = { name: string; value: string };
		const items: T[] = [{ name: 'a', value: 'a' }];
		const state = { items, cursor: -1, scrollOffset: 0, pageSize: 7 };
		const clamped = clampCursor(state);
		assert.equal(clamped.cursor, 0);
	});

	it('skips disabled items', () => {
		type T = { name: string; value: string; disabled?: boolean };
		const items: T[] = [
			{ name: 'a', value: 'a', disabled: true },
			{ name: 'b', value: 'b' },
		];
		const state = { items, cursor: 0, scrollOffset: 0, pageSize: 7 };
		const clamped = clampCursor(state);
		assert.equal(clamped.cursor, 1);
	});
});
