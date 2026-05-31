import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { completeBuffer } from '~/tui/completion.ts';

describe('completeBuffer — first-token completion', () => {
	it('returns noop for an empty buffer', () => {
		const r = completeBuffer('', 0);
		assert.equal(r.kind, 'noop');
	});

	it('completes a unique subcommand prefix', () => {
		const r = completeBuffer('setu', 4);
		// "setup" and "setup-project" / "setup-transitions" all match — multi
		assert.equal(r.kind, 'candidates');
		if (r.kind === 'candidates') {
			assert.ok(r.candidates.includes('setup'));
			assert.ok(r.candidates.includes('setup-project'));
			assert.ok(r.candidates.includes('setup-transitions'));
		}
	});

	it('completes a unique subcommand inline when only one matches', () => {
		const r = completeBuffer('lear', 4);
		assert.equal(r.kind, 'insert');
		if (r.kind === 'insert') {
			assert.equal(r.buffer, 'learn');
			assert.equal(r.cursor, 5);
		}
	});

	it('completes "doc" → doctor (single match)', () => {
		const r = completeBuffer('doc', 3);
		assert.equal(r.kind, 'insert');
		if (r.kind === 'insert') {
			assert.equal(r.buffer, 'doctor');
		}
	});

	it('includes builtin tokens (help, clear, exit) in first-token pool', () => {
		const helpR = completeBuffer('he', 2);
		assert.equal(helpR.kind, 'insert');
		if (helpR.kind === 'insert') assert.equal(helpR.buffer, 'help');

		const exitR = completeBuffer('exi', 3);
		assert.equal(exitR.kind, 'insert');
		if (exitR.kind === 'insert') assert.equal(exitR.buffer, 'exit');
	});

	it('returns noop for a first-token prefix with zero matches', () => {
		const r = completeBuffer('xyz', 3);
		assert.equal(r.kind, 'noop');
	});
});

describe('completeBuffer — flag completion', () => {
	it('completes a known flag for the current subcommand', () => {
		const r = completeBuffer('start KD-1 --au', 15);
		assert.equal(r.kind, 'insert');
		if (r.kind === 'insert') {
			assert.equal(r.buffer, 'start KD-1 --auto');
			assert.equal(r.cursor, 'start KD-1 --auto'.length);
		}
	});

	it('lists candidates when several flags share a prefix', () => {
		const r = completeBuffer('start KD-1 --with', 17);
		assert.equal(r.kind, 'candidates');
		if (r.kind === 'candidates') {
			assert.ok(r.candidates.includes('--with-cli'));
			assert.ok(r.candidates.includes('--with-model'));
		}
	});

	it('lists both done flags for the `-` prefix', () => {
		const r = completeBuffer('done KD-1 -', 11);
		assert.equal(r.kind, 'candidates');
		if (r.kind === 'candidates') {
			assert.ok(r.candidates.includes('-y'));
			assert.ok(r.candidates.includes('--auto-approve-pr-merge'));
		}
	});

	it('completes -y inline when the prefix is `-y`', () => {
		const r = completeBuffer('done KD-1 -y', 12);
		// already complete, but completion should still treat it as a unique match
		assert.equal(r.kind, 'insert');
		if (r.kind === 'insert') {
			assert.equal(r.buffer, 'done KD-1 -y');
		}
	});

	it('returns noop for flags of an unknown subcommand', () => {
		const r = completeBuffer('zzz --some', 10);
		assert.equal(r.kind, 'noop');
	});
});

describe('completeBuffer — non-flag positionals', () => {
	it('returns noop on a positional after a subcommand (does not complete ticket keys)', () => {
		const r = completeBuffer('start KD', 8);
		assert.equal(r.kind, 'noop');
	});
});

describe('completeBuffer — cursor position', () => {
	it('completes the token at the cursor, not the end of the buffer', () => {
		// Buffer: "setu  rest", cursor at end of "setu" (index 4)
		const r = completeBuffer('setu  rest', 4);
		assert.equal(r.kind, 'candidates'); // setup, setup-project, setup-transitions
	});

	it('treats a trailing space as the start of a new empty token (first position)', () => {
		// Cursor right after the space — first token already exists, second token is empty
		const r = completeBuffer('start ', 6);
		// Empty token, not flag-shaped → noop
		assert.equal(r.kind, 'noop');
	});
});
