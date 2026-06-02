import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	createComposerState,
	reduceComposer,
	composerText,
	composerIsEmpty,
	linearCursorOffset,
	type ComposerState,
} from '~/tui/composer.ts';

function typeChars(state: ComposerState, text: string): ComposerState {
	let s = state;
	for (const ch of text) s = reduceComposer(s, { kind: 'char', value: ch });
	return s;
}

describe('createComposerState', () => {
	it('initializes with one empty line', () => {
		const s = createComposerState();
		assert.deepEqual(s.lines, ['']);
		assert.equal(s.cursorLine, 0);
		assert.equal(s.cursorCol, 0);
	});
});

describe('composerText', () => {
	it('returns empty string for initial state', () => {
		assert.equal(composerText(createComposerState()), '');
	});

	it('joins lines with newline', () => {
		let s = typeChars(createComposerState(), 'a');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'b');
		assert.equal(composerText(s), 'a\nb');
	});
});

describe('composerIsEmpty', () => {
	it('returns true for initial state', () => {
		assert.ok(composerIsEmpty(createComposerState()));
	});

	it('returns false after typing', () => {
		const s = reduceComposer(createComposerState(), { kind: 'char', value: 'x' });
		assert.ok(!composerIsEmpty(s));
	});
});

describe('reduceComposer — char', () => {
	it('inserts a character', () => {
		const s = reduceComposer(createComposerState(), { kind: 'char', value: 'h' });
		assert.deepEqual(s.lines, ['h']);
		assert.equal(s.cursorCol, 1);
	});

	it('inserts at mid-cursor', () => {
		let s = typeChars(createComposerState(), 'ab');
		s = reduceComposer(s, { kind: 'left' });
		s = reduceComposer(s, { kind: 'char', value: 'X' });
		assert.equal(s.lines[0], 'aXb');
		assert.equal(s.cursorCol, 2);
	});

	it('multi-char insert advances cursor by value length', () => {
		let s = typeChars(createComposerState(), 'hello');
		s = reduceComposer(s, { kind: 'home' });
		s = reduceComposer(s, { kind: 'char', value: 'XX' });
		assert.equal(s.lines[0], 'XXhello');
		assert.equal(s.cursorCol, 2);
	});
});

describe('reduceComposer — backspace', () => {
	it('removes char before cursor', () => {
		let s = typeChars(createComposerState(), 'abc');
		s = reduceComposer(s, { kind: 'backspace' });
		assert.equal(s.lines[0], 'ab');
		assert.equal(s.cursorCol, 2);
	});

	it('merges lines when backspacing at line start', () => {
		let s = typeChars(createComposerState(), 'ab');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'cd');
		s = reduceComposer(s, { kind: 'home' });
		s = reduceComposer(s, { kind: 'backspace' });
		assert.deepEqual(s.lines, ['abcd']);
		assert.equal(s.cursorLine, 0);
	});

	it('no-op at start of first line', () => {
		const s = reduceComposer(createComposerState(), { kind: 'backspace' });
		assert.deepEqual(s.lines, ['']);
		assert.equal(s.cursorCol, 0);
	});
});

describe('reduceComposer — delete', () => {
	it('removes char after cursor', () => {
		let s = typeChars(createComposerState(), 'abc');
		s = reduceComposer(s, { kind: 'left' });
		s = reduceComposer(s, { kind: 'left' });
		s = reduceComposer(s, { kind: 'delete' });
		assert.equal(s.lines[0], 'ac');
	});

	it('merges with next line at end of line', () => {
		let s = typeChars(createComposerState(), 'ab');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'cd');
		s = reduceComposer(s, { kind: 'up' });
		s = reduceComposer(s, { kind: 'end' });
		s = reduceComposer(s, { kind: 'delete' });
		assert.deepEqual(s.lines, ['abcd']);
	});
});

describe('reduceComposer — newline', () => {
	it('splits line at cursor', () => {
		let s = typeChars(createComposerState(), 'abcd');
		s = reduceComposer(s, { kind: 'left' });
		s = reduceComposer(s, { kind: 'left' });
		s = reduceComposer(s, { kind: 'newline' });
		assert.deepEqual(s.lines, ['ab', 'cd']);
		assert.equal(s.cursorLine, 1);
		assert.equal(s.cursorCol, 0);
	});

	it('appends empty line at end', () => {
		let s = typeChars(createComposerState(), 'ab');
		s = reduceComposer(s, { kind: 'newline' });
		assert.deepEqual(s.lines, ['ab', '']);
		assert.equal(s.cursorLine, 1);
		assert.equal(s.cursorCol, 0);
	});
});

describe('reduceComposer — navigation', () => {
	it('left moves within line', () => {
		let s = typeChars(createComposerState(), 'abc');
		s = reduceComposer(s, { kind: 'left' });
		assert.equal(s.cursorCol, 2);
	});

	it('left wraps to previous line', () => {
		let s = typeChars(createComposerState(), 'ab');
		s = reduceComposer(s, { kind: 'newline' });
		s = reduceComposer(s, { kind: 'left' });
		assert.equal(s.cursorLine, 0);
		assert.equal(s.cursorCol, 2);
	});

	it('right wraps to next line', () => {
		let s = typeChars(createComposerState(), 'ab');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'c');
		s = reduceComposer(s, { kind: 'home' });
		s = reduceComposer(s, { kind: 'up' });
		s = reduceComposer(s, { kind: 'end' });
		s = reduceComposer(s, { kind: 'right' });
		assert.equal(s.cursorLine, 1);
		assert.equal(s.cursorCol, 0);
	});

	it('up moves to previous line clamping col', () => {
		let s = typeChars(createComposerState(), 'abcde');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'x');
		s = reduceComposer(s, { kind: 'home' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'up' });
		assert.equal(s.cursorLine, 0);
		assert.equal(s.cursorCol, 1);
	});

	it('down clamps col to shorter line', () => {
		let s = typeChars(createComposerState(), 'abc');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'x');
		s = reduceComposer(s, { kind: 'up' });
		s = reduceComposer(s, { kind: 'end' });
		s = reduceComposer(s, { kind: 'down' });
		assert.equal(s.cursorLine, 1);
		assert.equal(s.cursorCol, 1);
	});

	it('home/end move within line', () => {
		let s = typeChars(createComposerState(), 'abc');
		s = reduceComposer(s, { kind: 'home' });
		assert.equal(s.cursorCol, 0);

		const s2 = reduceComposer(s, { kind: 'end' });
		assert.equal(s2.cursorCol, 3);
	});
});

describe('reduceComposer — clear', () => {
	it('resets to initial state', () => {
		let s = typeChars(createComposerState(), 'abc');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'd');
		s = reduceComposer(s, { kind: 'clear' });
		assert.deepEqual(s.lines, ['']);
		assert.equal(s.cursorLine, 0);
		assert.equal(s.cursorCol, 0);
	});
});

describe('reduceComposer — setText', () => {
	it('sets single-line text with cursor at end', () => {
		const s = reduceComposer(createComposerState(), {
			kind: 'setText',
			value: 'hello',
		});
		assert.deepEqual(s.lines, ['hello']);
		assert.equal(s.cursorLine, 0);
		assert.equal(s.cursorCol, 5);
	});

	it('sets multi-line text with cursor at end of last line', () => {
		const s = reduceComposer(createComposerState(), {
			kind: 'setText',
			value: 'hello\nworld',
		});
		assert.deepEqual(s.lines, ['hello', 'world']);
		assert.equal(s.cursorLine, 1);
		assert.equal(s.cursorCol, 5);
	});

	it('sets empty text', () => {
		const s = reduceComposer(createComposerState(), {
			kind: 'setText',
			value: '',
		});
		assert.deepEqual(s.lines, ['']);
		assert.equal(s.cursorLine, 0);
		assert.equal(s.cursorCol, 0);
	});
});

describe('reduceComposer — killLine', () => {
	it('kills text from cursor to end of line', () => {
		let s = typeChars(createComposerState(), 'hello world');
		s = reduceComposer(s, { kind: 'home' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'killLine' });
		assert.equal(s.lines[0], 'hello');
		assert.equal(s.cursorCol, 5);
	});
});

describe('reduceComposer — killToStart', () => {
	it('kills text from start of line to cursor', () => {
		let s = typeChars(createComposerState(), 'hello world');
		s = reduceComposer(s, { kind: 'home' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'right' });
		s = reduceComposer(s, { kind: 'killToStart' });
		assert.equal(s.lines[0], ' world');
		assert.equal(s.cursorCol, 0);
	});
});

describe('reduceComposer — deleteWord', () => {
	it('deletes word before cursor', () => {
		let s = typeChars(createComposerState(), 'hello world');
		s = reduceComposer(s, { kind: 'deleteWord' });
		assert.equal(s.lines[0], 'hello ');
	});

	it('deletes word including leading spaces', () => {
		let s = typeChars(createComposerState(), 'hello   world');
		s = reduceComposer(s, { kind: 'deleteWord' });
		assert.equal(s.lines[0], 'hello   ');
	});

	it('deletes partial word when cursor is mid-word', () => {
		let s = typeChars(createComposerState(), 'hello   world');
		s = reduceComposer(s, { kind: 'left' });
		s = reduceComposer(s, { kind: 'deleteWord' });
		assert.equal(s.lines[0], 'hello   d');
	});
});

describe('linearCursorOffset', () => {
	it('returns 0 for initial state', () => {
		assert.equal(linearCursorOffset(createComposerState()), 0);
	});

	it('returns cursor col on single line', () => {
		let s = typeChars(createComposerState(), 'abc');
		s = reduceComposer(s, { kind: 'left' });
		assert.equal(linearCursorOffset(s), 2);
	});

	it('accounts for newlines', () => {
		let s = typeChars(createComposerState(), 'ab');
		s = reduceComposer(s, { kind: 'newline' });
		s = typeChars(s, 'cd');
		s = reduceComposer(s, { kind: 'home' });
		assert.equal(linearCursorOffset(s), 3); // 'ab\n' = 3, cursor at col 0 of 'cd'
	});
});
