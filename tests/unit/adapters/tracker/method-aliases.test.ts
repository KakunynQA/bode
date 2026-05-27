import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalTrackerAdapter } from '~/adapters/tracker/local.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';

const WORK = join(tmpdir(), 'bode-method-aliases-test');

describe('v0.25.0 — old and new method names produce identical results', () => {
	let tracker: LocalTrackerAdapter;

	before(async () => {
		await rm(WORK, { recursive: true, force: true });
		await mkdir(WORK, { recursive: true });
		tracker = new LocalTrackerAdapter(WORK);
		await tracker.createTask('alias-test', 'Alias test task', { type: 'Task' });
	});

	after(async () => {
		await rm(WORK, { recursive: true, force: true });
	});

	it('fetchTask returns the same value as getIssue', async () => {
		const a = await tracker.getIssue('alias-test');
		const b = await tracker.fetchTask('alias-test');
		assert.ok(a.ok && b.ok);
		assert.deepEqual(a.value, b.value);
	});

	it('addTag has the same effect as addLabel', async () => {
		await tracker.addTag('alias-test', 'via-addTag');
		const issue = await tracker.fetchTask('alias-test');
		assert.ok(issue.ok);
		assert.ok(issue.value.labels.includes('via-addTag'));

		await tracker.removeTag('alias-test', 'via-addTag');
		const after = await tracker.fetchTask('alias-test');
		assert.ok(after.ok);
		assert.ok(!after.value.labels.includes('via-addTag'));
	});

	it('postComment is equivalent to addComment', async () => {
		const r = await tracker.postComment('alias-test', 'a comment via postComment');
		assert.ok(r.ok);
		assert.equal(r.value.body, 'a comment via postComment');
	});

	it('setStatus is equivalent to transitionStatus', async () => {
		await tracker.setStatus('alias-test', 'implementing');
		const issue = await tracker.fetchTask('alias-test');
		assert.ok(issue.ok);
		assert.equal(issue.value.status, 'implementing');
	});

	it('listStatuses returns the same shape as getTransitions', async () => {
		const a = await tracker.getTransitions('alias-test');
		const b = await tracker.listStatuses('alias-test');
		assert.ok(a.ok && b.ok);
		assert.deepEqual(a.value, b.value);
	});
});

describe('MockJiraAdapter implements both name families', () => {
	it('new names route through old methods', async () => {
		const mock = new MockJiraAdapter();
		MockJiraAdapter.reset();
		MockJiraAdapter.seedIssue({
			key: 'MOCK-1',
			summary: 'mock',
			description: '',
			status: 'open',
			issueType: 'Task',
			assignee: null,
			labels: [],
			url: '',
		});
		const r1 = await mock.fetchTask('MOCK-1');
		assert.ok(r1.ok);
		assert.equal(r1.value.key, 'MOCK-1');

		await mock.addTag('MOCK-1', 'priority');
		const r2 = await mock.fetchTask('MOCK-1');
		assert.ok(r2.ok);
		assert.ok(r2.value.labels.includes('priority'));

		const r3 = await mock.postComment('MOCK-1', 'hi');
		assert.ok(r3.ok);
		assert.equal(r3.value.body, 'hi');

		const r4 = await mock.listStatuses('MOCK-1');
		assert.ok(r4.ok);
		assert.ok(r4.value.length > 0);
	});
});
