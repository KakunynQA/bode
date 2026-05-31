import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ghostCompletion } from '~/tui/completion.ts';

describe('ghostCompletion — first token (subcommand)', () => {
	it('returns empty for empty buffer', () => {
		assert.equal(ghostCompletion('', 0), '');
	});

	it('returns empty when cursor is not at the end', () => {
		// buffer "setu", cursor at 2 — user editing mid-text
		assert.equal(ghostCompletion('setu', 2), '');
	});

	it('suggests the rest of the first matching subcommand', () => {
		// "setup" is the first match for "setu" in ALL_SUBCOMMANDS declaration order
		assert.equal(ghostCompletion('setu', 4), 'p');
	});

	it('keeps suggesting a longer extension when the partial is already exact', () => {
		// "setup" exact match — we should still propose the next longer entry
		// "setup-project" (declaration order). Ghost = "-project".
		assert.equal(ghostCompletion('setup', 5), '-project');
	});

	it('suggests "earn" for "l"', () => {
		// First match for "l" in declaration order: "learn"
		assert.equal(ghostCompletion('l', 1), 'earn');
	});

	it('suggests builtins (help / clear / exit)', () => {
		assert.equal(ghostCompletion('he', 2), 'lp');
		assert.equal(ghostCompletion('cl', 2), 'ear');
		assert.equal(ghostCompletion('exi', 3), 't');
	});

	it('returns empty when no candidate starts with the partial', () => {
		assert.equal(ghostCompletion('xyz', 3), '');
	});
});

describe('ghostCompletion — flag completion', () => {
	it('suggests the rest of a flag for the active subcommand', () => {
		assert.equal(ghostCompletion('start KD-1 --au', 15), 'to');
	});

	it('picks the first matching flag in declaration order', () => {
		// "start" flags include --with-cli, --with-model (in that order).
		// Partial "--with" should ghost "-cli" (first match).
		assert.equal(ghostCompletion('start KD-1 --with', 17), '-cli');
	});

	it('returns empty for an unknown subcommand', () => {
		assert.equal(ghostCompletion('zzz --some', 10), '');
	});

	it('returns empty when no flag matches', () => {
		assert.equal(ghostCompletion('start KD-1 --xyz', 16), '');
	});
});

describe('ghostCompletion — positionals are not completed', () => {
	it('returns empty for a positional after a subcommand', () => {
		// `start KD` — no ghost (we don't complete ticket keys)
		assert.equal(ghostCompletion('start KD', 8), '');
	});

	it('returns empty for an empty token after a trailing space', () => {
		// `start ` cursor at 6 — partial is empty
		assert.equal(ghostCompletion('start ', 6), '');
	});
});

describe('ghostCompletion — Tab accept produces a valid command', () => {
	it('"setu" + ghost completes to "setup"', () => {
		const g = ghostCompletion('setu', 4);
		assert.equal('setu' + g, 'setup');
	});

	it('"setup" + ghost completes to "setup-project"', () => {
		const g = ghostCompletion('setup', 5);
		assert.equal('setup' + g, 'setup-project');
	});

	it('"start KD-1 --au" + ghost completes to "start KD-1 --auto"', () => {
		const g = ghostCompletion('start KD-1 --au', 15);
		assert.equal('start KD-1 --au' + g, 'start KD-1 --auto');
	});
});
