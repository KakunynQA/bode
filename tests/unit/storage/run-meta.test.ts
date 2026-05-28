import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRun, loadRunMeta, saveRunMeta } from '~/storage/run-meta.ts';

const TASK = 'TEST-RUNMETA-1';

describe('run-meta storage', () => {
	before(async () => {
		await rm(join(homedir(), '.bode', 'runs', TASK), { recursive: true, force: true });
	});
	after(async () => {
		await rm(join(homedir(), '.bode', 'runs', TASK), { recursive: true, force: true });
	});

	it('creates and reloads run', async () => {
		const created = await createRun(TASK, 'summary text', {
			branch: 'feat/test',
			baseBranch: 'main',
			projectName: 'proj',
			workdir: '/tmp/x',
		});
		assert.ok(created.ok);
		assert.equal(created.value.status, 'pending');
		assert.equal(created.value.branch, 'feat/test');

		const loaded = await loadRunMeta(TASK);
		assert.ok(loaded.ok);
		assert.ok(loaded.value);
		assert.equal(loaded.value!.trackerSummary, 'summary text');
		assert.equal(loaded.value!.workdir, '/tmp/x');
	});

	it('saveRunMeta updates updatedAt', async () => {
		const loaded = await loadRunMeta(TASK);
		assert.ok(loaded.ok && loaded.value);
		const orig = loaded.value!.updatedAt;
		await new Promise((r) => setTimeout(r, 10));
		await saveRunMeta({ ...loaded.value!, status: 'planning' });
		const reloaded = await loadRunMeta(TASK);
		assert.ok(reloaded.ok && reloaded.value);
		assert.equal(reloaded.value!.status, 'planning');
		assert.ok(reloaded.value!.updatedAt > orig);
	});

	it('returns null for missing task', async () => {
		const loaded = await loadRunMeta('DOES-NOT-EXIST');
		assert.ok(loaded.ok);
		assert.equal(loaded.value, null);
	});
});
