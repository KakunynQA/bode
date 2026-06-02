import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createActivityState, pushActivity } from '~/tui/activity.ts';
import { formatActivityForSnapshot } from '~/tui/components/run-view.tsx';

describe('formatActivityForSnapshot — home view (empty)', () => {
	it('renders nothing for empty activity', () => {
		const snap = formatActivityForSnapshot(createActivityState());
		assert.equal(snap, '');
	});
});

describe('formatActivityForSnapshot — run view with user task', () => {
	it('renders user task with ▸ prefix', () => {
		const a = pushActivity(createActivityState(), {
			kind: 'user-task',
			text: 'Fix the dashboard bug',
		});
		const snap = formatActivityForSnapshot(a);
		assert.ok(snap.includes('▸ Fix the dashboard bug'));
	});
});

describe('formatActivityForSnapshot — run view while phase running', () => {
	it('renders phase-start entries', () => {
		let a = pushActivity(createActivityState(), {
			kind: 'user-task',
			text: 'start KD-312',
		});
		a = pushActivity(a, { kind: 'phase-start', phase: 'planning', taskKey: 'KD-312' });
		a = pushActivity(a, {
			kind: 'command-output',
			text: 'Reading project configuration...',
		});
		a = pushActivity(a, {
			kind: 'artifact',
			label: 'plan',
			path: '~/.bode/runs/KD-312/planning.md',
		});
		const snap = formatActivityForSnapshot(a);
		assert.ok(snap.includes('▸ start KD-312'));
		assert.ok(snap.includes('planning'));
		assert.ok(snap.includes('Reading project configuration...'));
		assert.ok(snap.includes('→ plan:'));
	});
});

describe('formatActivityForSnapshot — run view after success', () => {
	it('renders success entry', () => {
		let a = pushActivity(createActivityState(), {
			kind: 'user-task',
			text: 'list',
		});
		a = pushActivity(a, { kind: 'success', text: 'list completed' });
		const snap = formatActivityForSnapshot(a);
		assert.ok(snap.includes('✓ list completed'));
	});
});

describe('formatActivityForSnapshot — run view after failure', () => {
	it('renders error entry with exit code', () => {
		let a = pushActivity(createActivityState(), {
			kind: 'user-task',
			text: 'start MISSING-999',
		});
		a = pushActivity(a, {
			kind: 'error',
			text: 'Task not found',
			exitCode: 1,
		});
		const snap = formatActivityForSnapshot(a);
		assert.ok(snap.includes('error: Task not found'));
		assert.ok(snap.includes('exit 1'));
	});
});

describe('formatActivityForSnapshot — phase complete with task key', () => {
	it('renders phase-complete with task key line', () => {
		let a = pushActivity(createActivityState(), {
			kind: 'user-task',
			text: 'start KD-312',
		});
		a = pushActivity(a, {
			kind: 'phase-complete',
			phase: 'planning',
			taskKey: 'KD-312',
		});
		const snap = formatActivityForSnapshot(a);
		assert.ok(snap.includes('✓ planning complete'));
		assert.ok(snap.includes('KD-312 · planning'));
	});
});

describe('formatActivityForSnapshot — warning entry', () => {
	it('renders warning with ! prefix', () => {
		let a = pushActivity(createActivityState(), {
			kind: 'user-task',
			text: 'doctor',
		});
		a = pushActivity(a, { kind: 'warning', text: 'git not found in PATH' });
		const snap = formatActivityForSnapshot(a);
		assert.ok(snap.includes('! git not found in PATH'));
	});
});
