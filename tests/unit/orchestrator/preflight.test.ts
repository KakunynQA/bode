import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { preflightProjectPaths } from '~/orchestrator/preflight.ts';
import type { ProjectConfig } from '~/config/schema.ts';

const ROOT = join(tmpdir(), 'bode-preflight-test');
const SIBLING = join(tmpdir(), 'bode-preflight-sibling');

describe('preflightProjectPaths', () => {
	before(async () => {
		await mkdir(join(ROOT, 'sub'), { recursive: true });
		await mkdir(SIBLING, { recursive: true });
	});

	after(async () => {
		await rm(ROOT, { recursive: true, force: true });
		await rm(SIBLING, { recursive: true, force: true });
	});

	it('passes when workdir + all paths are readable', async () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: ROOT,
			context_paths: ['.', 'sub'],
			repos: [{ workdir: SIBLING, name: 'sibling' }],
		};
		const result = await preflightProjectPaths(project);
		assert.ok(result.ok);
	});

	it('fails with structured issues when workdir is missing', async () => {
		const project: ProjectConfig = { name: 'test', workdir: '/does/not/exist/xyz' };
		const result = await preflightProjectPaths(project);
		assert.ok(!result.ok);
		assert.equal(result.error.issues.length, 1);
		assert.equal(result.error.issues[0]?.source, 'workdir');
		assert.equal(result.error.issues[0]?.reason, 'missing');
	});

	it('flags a sibling repo that does not exist', async () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: ROOT,
			repos: [{ workdir: '/does/not/exist/sibling' }],
		};
		const result = await preflightProjectPaths(project);
		assert.ok(!result.ok);
		const repoIssue = result.error.issues.find((i) => i.source === 'repos');
		assert.ok(repoIssue);
		assert.equal(repoIssue!.reason, 'missing');
	});

	it('resolves relative context_paths against workdir', async () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: ROOT,
			context_paths: ['sub'],
		};
		const result = await preflightProjectPaths(project);
		assert.ok(result.ok);
	});

	it('error message lists every issue path', async () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: '/does/not/exist/a',
			context_paths: ['x', 'y'],
		};
		const result = await preflightProjectPaths(project);
		assert.ok(!result.ok);
		assert.ok(result.error.message.includes('Preflight failed'));
		assert.ok(result.error.message.includes('workdir'));
	});
});
