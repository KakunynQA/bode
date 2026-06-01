import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	createPaletteState,
	reducePalette,
	selectedCommand,
	PALETTE_COMMANDS,
	type PaletteState,
} from '~/tui/palette.ts';

describe('createPaletteState', () => {
	it('creates state with default commands', () => {
		const s = createPaletteState();
		assert.ok(s.open === false);
		assert.equal(s.query, '');
		assert.ok(s.items.length > 0);
		assert.equal(s.filtered.length, s.items.length);
		assert.equal(s.cursor, 0);
	});

	it('categories are derived from items', () => {
		const s = createPaletteState();
		assert.ok(s.categories.length > 0);
		assert.ok(s.categories.includes('Suggested'));
		assert.ok(s.categories.includes('System'));
	});
});

describe('reducePalette — open/close', () => {
	it('opens the palette', () => {
		const s = reducePalette(createPaletteState(), { kind: 'open' });
		assert.ok(s.open);
		assert.equal(s.query, '');
		assert.equal(s.cursor, 0);
	});

	it('closes the palette', () => {
		const s1 = reducePalette(createPaletteState(), { kind: 'open' });
		const s2 = reducePalette(s1, { kind: 'close' });
		assert.ok(!s2.open);
		assert.equal(s2.query, '');
	});
});

describe('reducePalette — type/filter', () => {
	it('filters commands by query', () => {
		let s = reducePalette(createPaletteState(), { kind: 'open' });
		s = reducePalette(s, { kind: 'type', value: 'help' });
		assert.ok(s.filtered.length < PALETTE_COMMANDS.length);
		assert.ok(s.filtered.some((c) => c.id === 'open-help'));
		assert.equal(s.cursor, 0);
	});

	it('resets cursor to 0 on filter change', () => {
		let s = reducePalette(createPaletteState(), { kind: 'open' });
		s = reducePalette(s, { kind: 'down' });
		s = reducePalette(s, { kind: 'down' });
		assert.ok(s.cursor > 0);
		s = reducePalette(s, { kind: 'type', value: 'exit' });
		assert.equal(s.cursor, 0);
	});
});

describe('reducePalette — up/down', () => {
	it('down increments cursor', () => {
		const s1 = reducePalette(createPaletteState(), { kind: 'open' });
		const s2 = reducePalette(s1, { kind: 'down' });
		assert.equal(s2.cursor, 1);
	});

	it('up decrements cursor', () => {
		let s = reducePalette(createPaletteState(), { kind: 'open' });
		s = reducePalette(s, { kind: 'down' });
		s = reducePalette(s, { kind: 'down' });
		s = reducePalette(s, { kind: 'up' });
		assert.equal(s.cursor, 1);
	});

	it('up does not go below 0', () => {
		const s = reducePalette(createPaletteState(), { kind: 'open' });
		const s2 = reducePalette(s, { kind: 'up' });
		assert.equal(s2.cursor, 0);
	});

	it('down does not exceed filtered length', () => {
		let s = reducePalette(createPaletteState(), { kind: 'open' });
		for (let i = 0; i < PALETTE_COMMANDS.length + 5; i++) {
			s = reducePalette(s, { kind: 'down' });
		}
		assert.equal(s.cursor, s.filtered.length - 1);
	});
});

describe('selectedCommand', () => {
	it('returns command at cursor', () => {
		let s = reducePalette(createPaletteState(), { kind: 'open' });
		s = reducePalette(s, { kind: 'down' });
		const cmd = selectedCommand(s);
		assert.ok(cmd);
		assert.equal(cmd!.id, s.filtered[1]!.id);
	});

	it('returns null for empty filtered list', () => {
		const s: PaletteState = {
			open: true,
			query: 'zzzzz',
			items: PALETTE_COMMANDS,
			filtered: [],
			cursor: 0,
			categories: [],
		};
		assert.equal(selectedCommand(s), null);
	});
});

describe('reducePalette — reset', () => {
	it('resets to initial state', () => {
		let s = reducePalette(createPaletteState(), { kind: 'open' });
		s = reducePalette(s, { kind: 'type', value: 'xyz' });
		s = reducePalette(s, { kind: 'reset' });
		assert.ok(!s.open);
		assert.equal(s.query, '');
		assert.equal(s.filtered.length, PALETTE_COMMANDS.length);
	});
});
