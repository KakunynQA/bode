import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveProject } from '~/config/project-resolver.ts';
import type { BodeConfig } from '~/config/schema.ts';

const ROOT = join(tmpdir(), 'bode-project-resolver-test');
const REPO = join(ROOT, 'my-repo');
const NESTED = join(REPO, 'src', 'deeply', 'nested');

const baseConfig: BodeConfig = {
	jira: { site: 'x.atlassian.net', default_project: 'X' },
	phases: {
		planning: { cli: 'claude-code', model: 'm', timeout_minutes: 1 },
		implementation: { cli: 'claude-code', model: 'm', timeout_minutes: 1 },
		review: { cli: 'claude-code', model: 'm', timeout_minutes: 1 },
	},
};

describe('resolveProject — .bode.yml in repo (#8)', () => {
	before(async () => {
		await rm(ROOT, { recursive: true, force: true });
		await mkdir(NESTED, { recursive: true });
		await writeFile(
			join(REPO, '.bode.yml'),
			'default_branch: develop\nvcs_provider: gitlab\n',
			'utf-8'
		);
	});

	after(async () => {
		await rm(ROOT, { recursive: true, force: true });
	});

	it('finds .bode.yml in the cwd', async () => {
		const result = await resolveProject(baseConfig, { cwd: REPO });
		assert.ok(result.ok, JSON.stringify(result));
		assert.equal(result.value.projectConfig.default_branch, 'develop');
		assert.equal(result.value.projectConfig.vcs_provider, 'gitlab');
		assert.equal(result.value.projectConfig.workdir, REPO);
	});

	it('walks up to find .bode.yml from a nested dir', async () => {
		const result = await resolveProject(baseConfig, { cwd: NESTED });
		assert.ok(result.ok);
		assert.equal(result.value.projectConfig.default_branch, 'develop');
	});

	it('repo-local .bode.yml supersedes --project flag when omitted', async () => {
		// When --project IS set explicitly, the repo-local short-circuit should be
		// bypassed and the named-project flow runs.
		// This test asserts the inverse: without --project, repo-local wins.
		const result = await resolveProject(baseConfig, { cwd: REPO });
		assert.ok(result.ok);
		assert.equal(result.value.projectConfig.workdir, REPO);
	});
});
