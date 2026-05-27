import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubIssuesAdapter, __testing } from '~/adapters/tracker/github-issues.ts';

const { inferIssueType } = __testing;

describe('GitHubIssuesAdapter — key parsing (private but observable via mock)', () => {
	// We can't easily run gh in unit tests; we exercise the parser through the
	// adapter's behavior by constructing a wrong invocation and inspecting the
	// failure message. That's enough to assert the key-form parsing without
	// shelling out.
	it('accepts a plain number', async () => {
		const adapter = new GitHubIssuesAdapter({ workdir: '/tmp' });
		const result = await adapter.getIssue('123');
		// We expect failure (no gh repo here), but the cmd should reference `123`
		assert.ok(!result.ok);
		assert.ok(result.error.message.includes('123'), result.error.message);
	});

	it('accepts a hash-prefixed number', async () => {
		const adapter = new GitHubIssuesAdapter({ workdir: '/tmp' });
		const result = await adapter.getIssue('#456');
		assert.ok(!result.ok);
		assert.ok(result.error.message.includes('456'));
	});

	it('accepts owner/repo#number form', async () => {
		const adapter = new GitHubIssuesAdapter({ workdir: '/tmp' });
		const result = await adapter.getIssue('acme/widgets#7');
		assert.ok(!result.ok);
		assert.ok(result.error.message.includes('7'));
		assert.ok(result.error.message.includes('--repo'));
		assert.ok(result.error.message.includes('acme/widgets'));
	});
});

describe('inferIssueType', () => {
	it('returns Bug when "bug" label is present', () => {
		assert.equal(inferIssueType(['bug', 'p1']), 'Bug');
		assert.equal(inferIssueType(['Bug']), 'Bug');
	});

	it('returns Story for enhancement / feature labels', () => {
		assert.equal(inferIssueType(['enhancement']), 'Story');
		assert.equal(inferIssueType(['new-feature']), 'Story');
	});

	it('returns Task for chore / refactor', () => {
		assert.equal(inferIssueType(['chore']), 'Task');
		assert.equal(inferIssueType(['refactor-needed']), 'Task');
	});

	it('returns Task by default', () => {
		assert.equal(inferIssueType([]), 'Task');
		assert.equal(inferIssueType(['priority-high']), 'Task');
	});
});

describe('GitHubIssuesAdapter — getTransitions returns fixed bode lifecycle', () => {
	it('returns the bode phase list', async () => {
		const adapter = new GitHubIssuesAdapter({ workdir: '/tmp' });
		const r = await adapter.getTransitions('1');
		assert.ok(r.ok);
		const names = r.value.map((t) => t.toStatusName);
		assert.ok(names.includes('planning'));
		assert.ok(names.includes('implementing'));
		assert.ok(names.includes('done'));
	});

	it('attachFile is a no-op success', async () => {
		const adapter = new GitHubIssuesAdapter({ workdir: '/tmp' });
		const r = await adapter.attachFile('1', 'f.txt', 'x');
		assert.ok(r.ok);
	});

	it('transitionStatus to non-done is a no-op (labels carry state)', async () => {
		const adapter = new GitHubIssuesAdapter({ workdir: '/tmp' });
		const r = await adapter.transitionStatus('1', 'planning');
		assert.ok(r.ok);
	});
});
