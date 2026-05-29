import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanWorkdirFiles, __testing } from '~/utils/file-picker.ts';

describe('scanWorkdirFiles', () => {
	const BASE = join(tmpdir(), 'bode-test-picker-' + process.pid);

	before(async () => {
		await mkdir(join(BASE, 'src', 'utils'), { recursive: true });
		await mkdir(join(BASE, 'node_modules', 'pkg'), { recursive: true });
		await mkdir(join(BASE, '.git', 'objects'), { recursive: true });
		await mkdir(join(BASE, '.local', 'docs'), { recursive: true });
		await mkdir(join(BASE, '.bode'), { recursive: true });
		await mkdir(join(BASE, 'dist'), { recursive: true });
		await writeFile(join(BASE, 'AGENTS.md'), '', 'utf-8');
		await writeFile(join(BASE, 'CLAUDE.md'), '', 'utf-8');
		await writeFile(join(BASE, 'src', 'index.ts'), '', 'utf-8');
		await writeFile(join(BASE, 'src', 'utils', 'helpers.ts'), '', 'utf-8');
		await writeFile(join(BASE, 'node_modules', 'pkg', 'index.js'), '', 'utf-8');
		await writeFile(join(BASE, '.git', 'objects', 'abc'), '', 'utf-8');
		await writeFile(join(BASE, '.local', 'docs', 'plan.md'), '', 'utf-8');
		await writeFile(join(BASE, '.bode', 'context.md'), '', 'utf-8');
		await writeFile(join(BASE, 'dist', 'bundle.js'), '', 'utf-8');
		await writeFile(join(BASE, '.cursorrules'), '', 'utf-8');
	});

	after(async () => {
		await rm(BASE, { recursive: true, force: true });
	});

	it('returns workdir-relative paths with forward slashes', async () => {
		const files = await scanWorkdirFiles(BASE);
		for (const file of files) {
			assert.ok(!file.includes('\\'), `${file} should use forward slashes`);
		}
	});

	it('skips ignored directories', async () => {
		const files = await scanWorkdirFiles(BASE);
		assert.ok(!files.some((f) => f.startsWith('node_modules/')));
		assert.ok(!files.some((f) => f.startsWith('.git/')));
		assert.ok(!files.some((f) => f.startsWith('.local/')));
		assert.ok(!files.some((f) => f.startsWith('.bode/')));
		assert.ok(!files.some((f) => f.startsWith('dist/')));
	});

	it('includes regular files', async () => {
		const files = await scanWorkdirFiles(BASE);
		assert.ok(files.includes('AGENTS.md'));
		assert.ok(files.includes('CLAUDE.md'));
		assert.ok(files.includes('src/index.ts'));
		assert.ok(files.includes('src/utils/helpers.ts'));
	});

	it('keeps .cursorrules visible even though it starts with a dot', async () => {
		const files = await scanWorkdirFiles(BASE);
		assert.ok(files.includes('.cursorrules'));
	});

	it('ranks exact basename match highest', async () => {
		const files = await scanWorkdirFiles(BASE, 'CLAUDE.md');
		assert.equal(files[0], 'CLAUDE.md');
	});

	it('ranks prefix match above substring match', async () => {
		// "ind" — prefix on index.ts, substring elsewhere
		const score1 = __testing.scorePath('src/index.ts', 'ind');
		const score2 = __testing.scorePath('src/utils/helpers.ts', 'ind');
		assert.ok(score1 > score2);
	});

	it('subsequence matching returns a non-zero score', () => {
		assert.ok(__testing.scorePath('src/utils/helpers.ts', 'shts') > 0);
		assert.equal(__testing.scorePath('src/index.ts', 'xyz'), 0);
	});

	it('isSubsequence helper handles edge cases', () => {
		assert.equal(__testing.isSubsequence('', 'anything'), true);
		assert.equal(__testing.isSubsequence('abc', 'a-b-c'), true);
		assert.equal(__testing.isSubsequence('abc', 'cba'), false);
	});
});
