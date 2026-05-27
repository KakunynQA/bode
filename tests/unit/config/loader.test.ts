import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { projectConfigSchema, type ProjectConfig } from '~/config/schema.ts';
import { mergeProjectConfig } from '~/config/loader.ts';
import type { BodeConfig } from '~/config/schema.ts';
import { gatherContext, validateWorkdir } from '~/config/context.ts';

describe('project config schema', () => {
	it('validates a full project config', () => {
		const raw = {
			name: 'grid',
			workdir: '/home/user/grid-stack',
			jira: { site: 'co.atlassian.net', default_project: 'GRID' },
			context_paths: ['.', '../grid-ui/src'],
			context_files: ['AGENTS.md'],
		};
		const result = projectConfigSchema.safeParse(raw);
		assert.ok(result.success);
		assert.equal(result.data!.name, 'grid');
	});

	it('validates a minimal project config', () => {
		const raw = { name: 'simple', workdir: '/tmp/x' };
		const result = projectConfigSchema.safeParse(raw);
		assert.ok(result.success);
	});

	it('rejects missing name', () => {
		const raw = { workdir: '/tmp/x' };
		const result = projectConfigSchema.safeParse(raw);
		assert.ok(!result.success);
	});
});

describe('mergeProjectConfig', () => {
	const baseConfig: BodeConfig = {
		jira: { site: 'base.atlassian.net', default_project: 'BASE' },
		phases: {
			planning: { cli: 'claude-code', model: 'opus', timeout_minutes: 15 },
			implementation: { cli: 'opencode', model: 'sonnet', timeout_minutes: 60 },
			review: { cli: 'opencode', model: 'sonnet', timeout_minutes: 10 },
		},
	};

	it('overrides jira site and project', () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: '/tmp',
			jira: { site: 'override.atlassian.net', default_project: 'OVR' },
		};
		const merged = mergeProjectConfig(baseConfig, project);
		assert.equal(merged.jira.site, 'override.atlassian.net');
		assert.equal(merged.jira.default_project, 'OVR');
	});

	it('overrides individual phase settings', () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: '/tmp',
			phases: {
				planning: { cli: 'codex', model: 'gpt-5' },
			},
		};
		const merged = mergeProjectConfig(baseConfig, project);
		assert.equal(merged.phases.planning.cli, 'codex');
		assert.equal(merged.phases.planning.model, 'gpt-5');
		assert.equal(merged.phases.planning.timeout_minutes, 15);
	});

	it('keeps base config when project has no overrides', () => {
		const project: ProjectConfig = { name: 'test', workdir: '/tmp' };
		const merged = mergeProjectConfig(baseConfig, project);
		assert.equal(merged.jira.site, 'base.atlassian.net');
		assert.equal(merged.phases.planning.cli, 'claude-code');
	});
});

describe('context gathering', () => {
	const FIXTURE = join(tmpdir(), 'bode-ctx-test');

	before(async () => {
		await mkdir(FIXTURE, { recursive: true });
		await writeFile(join(FIXTURE, 'AGENTS.md'), '# Test Rules\nDo things right.', 'utf-8');
		await mkdir(join(FIXTURE, 'src'), { recursive: true });
		await writeFile(join(FIXTURE, 'src', 'index.ts'), 'export {}', 'utf-8');
		await writeFile(join(FIXTURE, 'package.json'), '{}', 'utf-8');
	});

	after(async () => {
		await rm(FIXTURE, { recursive: true, force: true });
	});

	it('reads AGENTS.md and generates file tree', async () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: FIXTURE,
			context_files: ['AGENTS.md'],
			context_paths: ['.'],
		};
		const ctx = await gatherContext(project);
		assert.ok(ctx.agentsMd);
		assert.ok(ctx.agentsMd!.includes('Test Rules'));
		assert.ok(ctx.fileTree);
		assert.ok(ctx.fileTree!.includes('src/'));
		assert.ok(ctx.fileTree!.includes('package.json'));
	});

	it('returns undefined when no context files exist', async () => {
		const project: ProjectConfig = {
			name: 'test',
			workdir: FIXTURE,
			context_files: ['NONEXISTENT.md'],
		};
		const ctx = await gatherContext(project);
		assert.equal(ctx.agentsMd, undefined);
	});
});

describe('validateWorkdir', () => {
	it('succeeds for existing directory', async () => {
		const result = await validateWorkdir(tmpdir());
		assert.ok(result.ok);
	});

	it('fails for non-existent directory', async () => {
		const result = await validateWorkdir('/nonexistent/path/xyz');
		assert.ok(!result.ok);
	});
});
