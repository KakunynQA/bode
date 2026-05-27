import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeJson, readJson } from '~/utils/fs.ts';

const DIR = join(tmpdir(), 'bode-atomic-test');

describe('writeJson — atomic', () => {
	before(async () => {
		await rm(DIR, { recursive: true, force: true });
		await mkdir(DIR, { recursive: true });
	});

	after(async () => {
		await rm(DIR, { recursive: true, force: true });
	});

	it('writes the destination file', async () => {
		const path = join(DIR, 'a.json');
		await writeJson(path, { a: 1, b: 'two' });
		const loaded = await readJson<{ a: number; b: string }>(path);
		assert.deepEqual(loaded, { a: 1, b: 'two' });
	});

	it('does not leave temp files behind on success', async () => {
		const path = join(DIR, 'b.json');
		await writeJson(path, { ok: true });
		const entries = await readdir(DIR);
		const tempLeftover = entries.filter((e) => e.startsWith('b.json.tmp.'));
		assert.equal(tempLeftover.length, 0);
	});

	it('replaces existing content atomically', async () => {
		const path = join(DIR, 'c.json');
		await writeJson(path, { version: 1 });
		await writeJson(path, { version: 2 });
		const raw = await readFile(path, 'utf-8');
		assert.equal(JSON.parse(raw).version, 2);
	});

	it('rewrite produces valid JSON (never a partial state)', async () => {
		const path = join(DIR, 'd.json');
		await writeJson(path, { n: 1 });
		// 10 sequential rewrites; each one should leave the file fully valid.
		for (let i = 2; i <= 10; i++) {
			await writeJson(path, { n: i });
			const raw = await readFile(path, 'utf-8');
			JSON.parse(raw); // throws if corrupt
		}
		const final = await readJson<{ n: number }>(path);
		assert.equal(final?.n, 10);
	});
});
