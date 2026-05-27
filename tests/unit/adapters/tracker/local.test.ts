import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalTrackerAdapter, __testing } from '~/adapters/tracker/local.ts';

const WORK = join(tmpdir(), 'bode-local-tracker-test');
const KEY = 'fix-the-bug';

describe('LocalTrackerAdapter', () => {
	let tracker: LocalTrackerAdapter;

	before(async () => {
		await rm(WORK, { recursive: true, force: true });
		await mkdir(WORK, { recursive: true });
		tracker = new LocalTrackerAdapter(WORK);
	});

	after(async () => {
		await rm(WORK, { recursive: true, force: true });
	});

	it('createTask writes frontmatter + body', async () => {
		const result = await tracker.createTask(KEY, 'Fix the dashboard bug', {
			type: 'Bug',
			labels: ['ui'],
		});
		assert.ok(result.ok);
		assert.equal(result.value.summary, 'Fix the dashboard bug');
		assert.equal(result.value.issueType, 'Bug');
		assert.deepEqual(result.value.labels, ['ui']);
		assert.equal(result.value.status, 'pending');

		const raw = await readFile(join(WORK, '.bode', 'tasks', `${KEY}.md`), 'utf-8');
		assert.ok(raw.startsWith('---\n'));
		assert.ok(raw.includes('summary: Fix the dashboard bug'));
		assert.ok(raw.includes('status: pending'));
	});

	it('getIssue returns existing task', async () => {
		const result = await tracker.getIssue(KEY);
		assert.ok(result.ok);
		assert.equal(result.value.key, KEY);
		assert.equal(result.value.summary, 'Fix the dashboard bug');
	});

	it('getIssue returns error for missing task', async () => {
		const result = await tracker.getIssue('does-not-exist');
		assert.ok(!result.ok);
		assert.ok(result.error.message.includes('not found'));
	});

	it('addComment appends a section to the body', async () => {
		const before = await readFile(join(WORK, '.bode', 'tasks', `${KEY}.md`), 'utf-8');
		const r = await tracker.addComment(KEY, 'Tried X, did not work');
		assert.ok(r.ok);
		const after = await readFile(join(WORK, '.bode', 'tasks', `${KEY}.md`), 'utf-8');
		assert.ok(after.length > before.length);
		assert.ok(after.includes('## Comment —'));
		assert.ok(after.includes('Tried X, did not work'));
	});

	it('transitionStatus updates frontmatter', async () => {
		const r = await tracker.transitionStatus(KEY, 'implementing');
		assert.ok(r.ok);
		const issue = await tracker.getIssue(KEY);
		assert.ok(issue.ok);
		assert.equal(issue.value.status, 'implementing');
	});

	it('addLabel + removeLabel mutate frontmatter', async () => {
		await tracker.addLabel(KEY, 'priority-high');
		const after1 = await tracker.getIssue(KEY);
		assert.ok(after1.ok);
		assert.ok(after1.value.labels.includes('priority-high'));

		await tracker.removeLabel(KEY, 'priority-high');
		const after2 = await tracker.getIssue(KEY);
		assert.ok(after2.ok);
		assert.ok(!after2.value.labels.includes('priority-high'));
	});

	it('addLabel is idempotent', async () => {
		await tracker.addLabel(KEY, 'x');
		await tracker.addLabel(KEY, 'x');
		const issue = await tracker.getIssue(KEY);
		assert.ok(issue.ok);
		const count = issue.value.labels.filter((l) => l === 'x').length;
		assert.equal(count, 1);
	});

	it('getTransitions returns the bode lifecycle states', async () => {
		const r = await tracker.getTransitions(KEY);
		assert.ok(r.ok);
		const ids = r.value.map((t) => t.id);
		assert.ok(ids.includes('implementing'));
		assert.ok(ids.includes('awaiting-merge'));
		assert.ok(ids.includes('done'));
	});
});

describe('parseLocalTask / serializeLocalTask roundtrip', () => {
	it('parses frontmatter + body', () => {
		const raw = '---\nstatus: planning\nlabels: [a, b]\n---\n\n# Body here';
		const r = __testing.parseLocalTask(raw);
		assert.ok(r.ok);
		assert.equal(r.value.frontmatter.status, 'planning');
		assert.deepEqual(r.value.frontmatter.labels, ['a', 'b']);
		assert.ok(r.value.body.includes('# Body here'));
	});

	it('handles content with no frontmatter', () => {
		const r = __testing.parseLocalTask('# Just a body');
		assert.ok(r.ok);
		assert.deepEqual(r.value.frontmatter, {});
		assert.equal(r.value.body, '# Just a body');
	});

	it('serialize then parse roundtrips', () => {
		const original = { summary: 'X', status: 'planning', labels: ['a'] };
		const serialized = __testing.serializeLocalTask(original, '# X\n\nDesc');
		const parsed = __testing.parseLocalTask(serialized);
		assert.ok(parsed.ok);
		assert.equal(parsed.value.frontmatter.summary, 'X');
		assert.equal(parsed.value.frontmatter.status, 'planning');
		assert.ok(parsed.value.body.includes('# X'));
	});
});
