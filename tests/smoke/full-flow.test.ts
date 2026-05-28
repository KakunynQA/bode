import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRun, loadRunMeta, saveRunMeta } from '~/storage/run-meta.ts';
import { acquireLock, inspectLock } from '~/storage/lockfile.ts';
import { getNextPhase } from '~/types/phase.ts';
import type { PhaseStatus, RunMeta } from '~/storage/run-meta.ts';

const KEY = `SMOKE-${process.pid}-${Date.now()}`;
const runsDir = (k: string) => join(homedir(), '.bode', 'runs', k.toUpperCase());

describe('full-flow smoke: run lifecycle', () => {
	before(async () => {
		await rm(runsDir(KEY), { recursive: true, force: true });
	});

	after(async () => {
		await rm(runsDir(KEY), { recursive: true, force: true });
	});

	it('creates a run with correct initial state', async () => {
		const result = await createRun(KEY, 'Smoke test task');
		assert.ok(result.ok, 'createRun should succeed');
		const meta = result.value;
		assert.equal(meta.taskKey, KEY.toUpperCase());
		assert.equal(meta.trackerSummary, 'Smoke test task');
		assert.equal(meta.status, 'pending');
		assert.ok(meta.startedAt > 0);
		assert.ok(meta.updatedAt > 0);
	});

	it('persists meta.json to disk', async () => {
		const loaded = await loadRunMeta(KEY);
		assert.ok(loaded.ok, 'loadRunMeta should succeed');
		assert.ok(loaded.value, 'meta should exist');
		assert.equal(loaded.value!.status, 'pending');
		assert.equal(loaded.value!.taskKey, KEY.toUpperCase());
	});

	it('advances through the full phase chain', async () => {
		const transitions: Array<[PhaseStatus, PhaseStatus]> = [
			['pending', 'planning'],
			['planning', 'planned'],
			['planned', 'implementing'],
			['implementing', 'reviewing'],
			['reviewing', 'reviewed'],
			['reviewed', 'awaiting-merge'],
			['awaiting-merge', 'done'],
		];

		let current: RunMeta = (await loadRunMeta(KEY))!.value!;

		for (const [from, to] of transitions) {
			assert.equal(current.status, from, `should be ${from} before advancing`);

			const next = getNextPhase(from);
			assert.equal(next, to, `getNextPhase(${from}) should return ${to}`);

			const updated: RunMeta = { ...current, status: to };

			if (to === 'awaiting-merge') {
				updated.branch = 'feat/smoke-test';
				updated.baseBranch = 'main';
				updated.prUrl = 'https://github.com/example/repo/pull/1';
				updated.prNumber = 1;
			}

			const saved = await saveRunMeta(updated);
			assert.ok(saved.ok, `saveRunMeta at ${to} should succeed`);

			const reloaded = await loadRunMeta(KEY);
			assert.ok(reloaded.ok && reloaded.value, `loadRunMeta at ${to} should succeed`);
			assert.equal(reloaded.value!.status, to, `reloaded status should be ${to}`);

			if (to === 'awaiting-merge') {
				assert.equal(reloaded.value!.branch, 'feat/smoke-test');
				assert.equal(reloaded.value!.baseBranch, 'main');
				assert.equal(reloaded.value!.prUrl, 'https://github.com/example/repo/pull/1');
				assert.equal(reloaded.value!.prNumber, 1);
			}

			current = reloaded.value!;
		}

		assert.equal(current.status, 'done');
		assert.equal(getNextPhase('done'), null);
	});

	it('acquires and releases lock for the run', async () => {
		const lock = await acquireLock(KEY, 'smoke-test');
		assert.ok(lock.ok, 'acquireLock should succeed');

		const info = await inspectLock(KEY);
		assert.ok(info, 'lock file should exist');
		assert.equal(info!.pid, process.pid);

		await lock.value.release();

		const afterRelease = await inspectLock(KEY);
		assert.equal(afterRelease, null, 'lock file should be removed');
	});

	it('returns null for non-existent task key', async () => {
		const loaded = await loadRunMeta('SMOKE-NONEXISTENT-999');
		assert.ok(loaded.ok);
		assert.equal(loaded.value, null);
	});

	it('refuses to create a run with a duplicate key', async () => {
		const first = await createRun(KEY, 'duplicate test');
		assert.ok(first.ok);

		const second = await createRun(KEY, 'duplicate test again');
		assert.ok(second.ok);

		const loaded = await loadRunMeta(KEY);
		assert.ok(loaded.ok && loaded.value);
		assert.equal(loaded.value!.status, 'pending');
		assert.equal(loaded.value!.trackerSummary, 'duplicate test again');
	});
});
