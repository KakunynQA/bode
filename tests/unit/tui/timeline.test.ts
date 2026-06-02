import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	createTimelineState,
	pushEntry,
	appendToLastOutput,
	timelineIsEmpty,
} from '~/tui/timeline.ts';

describe('createTimelineState', () => {
	it('creates empty timeline', () => {
		const s = createTimelineState();
		assert.equal(s.entries.length, 0);
	});
});

describe('timelineIsEmpty', () => {
	it('returns true for empty timeline', () => {
		assert.ok(timelineIsEmpty(createTimelineState()));
	});

	it('returns false after pushing an entry', () => {
		const s = pushEntry(createTimelineState(), { kind: 'user', text: 'hello' });
		assert.ok(!timelineIsEmpty(s));
	});
});

describe('pushEntry', () => {
	it('appends user entry', () => {
		const s = pushEntry(createTimelineState(), { kind: 'user', text: 'setup' });
		assert.equal(s.entries.length, 1);
		assert.equal(s.entries[0]!.kind, 'user');
		if (s.entries[0]!.kind === 'user') {
			assert.equal(s.entries[0]!.text, 'setup');
		}
	});

	it('appends multiple entries in order', () => {
		let s = pushEntry(createTimelineState(), { kind: 'user', text: 'first' });
		s = pushEntry(s, { kind: 'stdout', text: 'output' });
		s = pushEntry(s, { kind: 'success', text: 'done', exitCode: 0 });
		assert.equal(s.entries.length, 3);
		assert.equal(s.entries[0]!.kind, 'user');
		assert.equal(s.entries[1]!.kind, 'stdout');
		assert.equal(s.entries[2]!.kind, 'success');
	});

	it('does not mutate original state', () => {
		const original = createTimelineState();
		const next = pushEntry(original, { kind: 'user', text: 'hello' });
		assert.equal(original.entries.length, 0);
		assert.equal(next.entries.length, 1);
	});
});

describe('appendToLastOutput', () => {
	it('appends to last stdout entry', () => {
		let s = pushEntry(createTimelineState(), { kind: 'stdout', text: 'hello' });
		s = appendToLastOutput(s, ' world');
		assert.equal(s.entries[0]!.kind, 'stdout');
		if (s.entries[0]!.kind === 'stdout') {
			assert.equal(s.entries[0]!.text, 'hello world');
		}
	});

	it('appends to last stderr entry', () => {
		let s = pushEntry(createTimelineState(), { kind: 'stderr', text: 'err' });
		s = appendToLastOutput(s, ' more');
		assert.equal(s.entries[0]!.kind, 'stderr');
		if (s.entries[0]!.kind === 'stderr') {
			assert.equal(s.entries[0]!.text, 'err more');
		}
	});

	it('no-op when last entry is not stdout/stderr', () => {
		let s = pushEntry(createTimelineState(), { kind: 'user', text: 'cmd' });
		s = appendToLastOutput(s, 'extra');
		assert.equal(s.entries.length, 1);
		if (s.entries[0]!.kind === 'user') {
			assert.equal(s.entries[0]!.text, 'cmd');
		}
	});

	it('no-op on empty timeline', () => {
		const s = appendToLastOutput(createTimelineState(), 'text');
		assert.equal(s.entries.length, 0);
	});
});
