import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	BackError,
	AT_TRIGGER,
	BACK,
	__testing,
	type PromptState,
	type KeyEvent,
} from '~/utils/prompt.ts';

const { reduceKeystroke, parseChunk } = __testing;

const empty: PromptState = { buffer: '', cursor: 0 };
const abc: PromptState = { buffer: 'abc', cursor: 3 };
const abcMid: PromptState = { buffer: 'abc', cursor: 1 };

function feed(state: PromptState, keys: KeyEvent[]): PromptState {
	let s = state;
	for (const k of keys) s = reduceKeystroke(s, k);
	return s;
}

describe('BackError', () => {
	it('is an Error subclass with name "BackError"', () => {
		const err = new BackError();
		assert.ok(err instanceof Error);
		assert.equal(err.name, 'BackError');
		assert.equal(err.message, '__BACK__');
	});
});

describe('BACK sentinel', () => {
	it('is a unique symbol', () => {
		assert.equal(typeof BACK, 'symbol');
		const same = BACK === BACK;
		assert.equal(same, true);
	});
});

describe('AT_TRIGGER sentinel', () => {
	it('is a unique symbol', () => {
		assert.equal(typeof AT_TRIGGER, 'symbol');
		const same = AT_TRIGGER === AT_TRIGGER;
		assert.equal(same, true);
	});
});

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

	it('@ keypress returns exit=AT_TRIGGER and does not mutate buffer', () => {
		const next = reduceKeystroke({ buffer: 'foo', cursor: 3 }, { kind: 'at' });
		assert.deepEqual(next, { buffer: 'foo', cursor: 3, exit: 'AT_TRIGGER' });
	});

	it('Enter returns exit=DONE with the current buffer', () => {
		const next = reduceKeystroke({ buffer: 'hello', cursor: 5 }, { kind: 'enter' });
		assert.deepEqual(next, { buffer: 'hello', cursor: 5, exit: 'DONE' });
	});

	it('Escape returns exit=BACK', () => {
		const next = reduceKeystroke(abc, { kind: 'esc' });
		assert.deepEqual(next, { ...abc, exit: 'BACK' });
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

	it('parses CSI arrow keys', () => {
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

	it('ignores Up / Down CSI sequences', () => {
		assert.deepEqual(parseChunk('\x1b[A'), []);
		assert.deepEqual(parseChunk('\x1b[B'), []);
	});

	it('lone trailing ESC at end of chunk parses as esc', () => {
		assert.deepEqual(parseChunk('a\x1b'), [{ kind: 'char', value: 'a' }, { kind: 'esc' }]);
	});

	it('mid-chunk lone ESC is dropped (likely Alt-prefix)', () => {
		// `\x1ba` is Alt+a — we don't support Alt keys, so the ESC is dropped
		// and only the 'a' is reported.
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
