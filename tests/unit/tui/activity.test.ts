import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	createActivityState,
	pushActivity,
	appendToLastOutput,
	activityIsEmpty,
	lastEntry,
} from '~/tui/activity.ts';

describe('createActivityState', () => {
	it('creates empty state', () => {
		const s = createActivityState();
		assert.equal(s.entries.length, 0);
	});
});

describe('activityIsEmpty', () => {
	it('returns true for empty state', () => {
		assert.ok(activityIsEmpty(createActivityState()));
	});

	it('returns false after pushing an entry', () => {
		const s = pushActivity(createActivityState(), { kind: 'user-task', text: 'hello' });
		assert.ok(!activityIsEmpty(s));
	});
});

describe('pushActivity', () => {
	it('appends user-task entry', () => {
		const s = pushActivity(createActivityState(), { kind: 'user-task', text: 'setup' });
		assert.equal(s.entries.length, 1);
		assert.equal(s.entries[0]!.kind, 'user-task');
		if (s.entries[0]!.kind === 'user-task') {
			assert.equal(s.entries[0]!.text, 'setup');
		}
	});

	it('appends phase-start entry', () => {
		const s = pushActivity(createActivityState(), { kind: 'phase-start', phase: 'planning' });
		assert.equal(s.entries.length, 1);
		assert.equal(s.entries[0]!.kind, 'phase-start');
	});

	it('appends artifact entry', () => {
		const s = pushActivity(createActivityState(), {
			kind: 'artifact',
			label: 'plan',
			path: '~/.bode/runs/KD-1/planning.md',
		});
		assert.equal(s.entries[0]!.kind, 'artifact');
		if (s.entries[0]!.kind === 'artifact') {
			assert.equal(s.entries[0]!.label, 'plan');
		}
	});

	it('appends multiple entries in order', () => {
		let s = pushActivity(createActivityState(), { kind: 'user-task', text: 'first' });
		s = pushActivity(s, { kind: 'command-output', text: 'output' });
		s = pushActivity(s, { kind: 'success', text: 'done' });
		assert.equal(s.entries.length, 3);
		assert.equal(s.entries[0]!.kind, 'user-task');
		assert.equal(s.entries[1]!.kind, 'command-output');
		assert.equal(s.entries[2]!.kind, 'success');
	});

	it('does not mutate original state', () => {
		const original = createActivityState();
		const next = pushActivity(original, { kind: 'user-task', text: 'hello' });
		assert.equal(original.entries.length, 0);
		assert.equal(next.entries.length, 1);
	});
});

describe('lastEntry', () => {
	it('returns null for empty state', () => {
		assert.equal(lastEntry(createActivityState()), null);
	});

	it('returns last entry', () => {
		const s = pushActivity(createActivityState(), { kind: 'info', text: 'a' });
		const entry = lastEntry(s);
		assert.ok(entry);
		if (entry!.kind === 'info') {
			assert.equal(entry.text, 'a');
		}
	});
});

describe('appendToLastOutput', () => {
	it('appends to last command-output entry', () => {
		let s = pushActivity(createActivityState(), { kind: 'command-output', text: 'hello' });
		s = appendToLastOutput(s, ' world');
		assert.equal(s.entries[0]!.kind, 'command-output');
		if (s.entries[0]!.kind === 'command-output') {
			assert.equal(s.entries[0]!.text, 'hello world');
		}
	});

	it('no-op when last entry is not command-output', () => {
		let s = pushActivity(createActivityState(), { kind: 'user-task', text: 'cmd' });
		s = appendToLastOutput(s, 'extra');
		assert.equal(s.entries.length, 1);
		if (s.entries[0]!.kind === 'user-task') {
			assert.equal(s.entries[0]!.text, 'cmd');
		}
	});

	it('no-op on empty state', () => {
		const s = appendToLastOutput(createActivityState(), 'text');
		assert.equal(s.entries.length, 0);
	});
});
