import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveSkillPath, loadSkillPrompt } from '~/skills/resolver.ts';

const ROOT = join(tmpdir(), 'bode-skill-resolver-test');
const PROJECT = join(ROOT, 'project');
const GLOBAL = join(ROOT, 'home', '.bode');

describe('resolveSkillPath', () => {
	before(async () => {
		await mkdir(join(PROJECT, '.bode', 'skills'), { recursive: true });
		await mkdir(join(GLOBAL, 'skills'), { recursive: true });
	});

	after(async () => {
		await rm(ROOT, { recursive: true, force: true });
	});

	it('prefers project skill over global', async () => {
		await writeFile(join(PROJECT, '.bode', 'skills', 'planning.md'), 'PROJECT', 'utf-8');
		await writeFile(join(GLOBAL, 'skills', 'planning.md'), 'GLOBAL', 'utf-8');

		const result = await resolveSkillPath('planning', {
			projectRoot: PROJECT,
			globalDir: join(GLOBAL, 'skills'),
		});
		assert.ok(result.ok);
		assert.ok(result.value.includes('project'));

		const loaded = await loadSkillPrompt('planning', {
			projectRoot: PROJECT,
			globalDir: join(GLOBAL, 'skills'),
		});
		assert.ok(loaded.ok);
		assert.equal(loaded.value, 'PROJECT');
	});

	it('falls back to global when no project skill exists', async () => {
		await writeFile(join(GLOBAL, 'skills', 'implementation.md'), 'GLOBAL_IMPL', 'utf-8');

		const result = await resolveSkillPath('implementation', {
			projectRoot: PROJECT,
			globalDir: join(GLOBAL, 'skills'),
		});
		assert.ok(result.ok);

		const loaded = await loadSkillPrompt('implementation', {
			projectRoot: PROJECT,
			globalDir: join(GLOBAL, 'skills'),
		});
		assert.ok(loaded.ok);
		assert.equal(loaded.value, 'GLOBAL_IMPL');
	});

	it('falls back to bundled defaults from src/ in dev mode', async () => {
		const result = await resolveSkillPath('review', {
			projectRoot: '/nonexistent',
			globalDir: '/nonexistent',
		});
		assert.ok(result.ok);
		const loaded = await loadSkillPrompt('review', {
			projectRoot: '/nonexistent',
			globalDir: '/nonexistent',
		});
		assert.ok(loaded.ok);
		assert.ok(loaded.value.length > 0);
	});

	it('returns error for unknown phase', async () => {
		const result = await resolveSkillPath('nonexistent', {
			projectRoot: '/nonexistent',
			globalDir: '/nonexistent',
		});
		assert.ok(!result.ok);
	});
});
