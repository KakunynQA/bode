import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findLatestRun } from '~/tui/state.ts';

describe('findLatestRun', () => {
	let runsDir: string;
	let root: string;

	before(async () => {
		root = mkdtempSync(join(tmpdir(), 'bode-tui-state-'));
		runsDir = join(root, 'runs');
		await mkdir(runsDir, { recursive: true });
	});

	after(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it('returns null when the runs directory does not exist', async () => {
		const result = await findLatestRun(join(root, 'nonexistent'));
		assert.equal(result, null);
	});

	it('returns null when the runs directory has no entries', async () => {
		const result = await findLatestRun(runsDir);
		assert.equal(result, null);
	});

	it('returns the most recently modified run by mtime', async () => {
		const oldDir = join(runsDir, 'OLD-1');
		const newDir = join(runsDir, 'NEW-2');
		await mkdir(oldDir, { recursive: true });
		await mkdir(newDir, { recursive: true });

		await writeFile(
			join(oldDir, 'meta.json'),
			JSON.stringify({
				taskKey: 'OLD-1',
				trackerSummary: 'old task',
				status: 'planning',
				startedAt: 1,
				updatedAt: 1,
			}),
			'utf-8'
		);
		// Force newer mtime on the second meta by writing after a short delay.
		await new Promise((r) => setTimeout(r, 25));
		await writeFile(
			join(newDir, 'meta.json'),
			JSON.stringify({
				taskKey: 'NEW-2',
				trackerSummary: 'new task',
				status: 'implementation',
				startedAt: 2,
				updatedAt: 2,
			}),
			'utf-8'
		);

		const result = await findLatestRun(runsDir);
		assert.ok(result);
		assert.equal(result.key, 'NEW-2');
		assert.equal(result.phase, 'implementation');
	});

	it('skips entries without a meta.json', async () => {
		const noMetaDir = join(runsDir, 'NOMETA-1');
		await mkdir(noMetaDir, { recursive: true });
		const result = await findLatestRun(runsDir);
		// Still picks NEW-2 from the previous test (since this dir has no meta).
		assert.ok(result);
		assert.equal(result.key, 'NEW-2');
	});
});
