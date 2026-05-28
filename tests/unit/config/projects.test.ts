import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { listProjects, loadProjectConfig } from '~/config/projects.ts';

const PREFIX = `_bode_test_${process.pid}_`;
const PROJECTS_DIR = join(homedir(), '.bode', 'projects');

const VALID_YAML = ['name: test-project', 'workdir: /tmp/test'].join('\n');

const INVALID_YAML = ['name: ""', 'workdir: ""'].join('\n');

function testName(label: string) {
	return `${PREFIX}${label}`;
}
function testYmlPath(label: string) {
	return join(PROJECTS_DIR, `${testName(label)}.yml`);
}

describe('listProjects', () => {
	before(async () => {
		await mkdir(PROJECTS_DIR, { recursive: true });
		await writeFile(testYmlPath('valid-a'), VALID_YAML, 'utf-8');
		await writeFile(testYmlPath('invalid-a'), INVALID_YAML, 'utf-8');
	});

	after(async () => {
		await rm(testYmlPath('valid-a'), { force: true });
		await rm(testYmlPath('invalid-a'), { force: true });
	});

	it('returns valid projects and skips invalid ones', async () => {
		const result = await listProjects();
		assert.ok(result.ok);
		const names = result.value!.map((p) => p.name);
		assert.ok(names.includes('test-project'));
		assert.ok(!names.includes(''));
	});

	it('returns ok:true with empty array when projects dir has no yaml', async () => {
		const backupDir = join(PROJECTS_DIR, `_nobode_${process.pid}`);
		await mkdir(backupDir, { recursive: true });
		await writeFile(join(backupDir, 'readme.txt'), 'not yaml', 'utf-8');
		const result = await listProjects();
		assert.ok(result.ok);
		const matched = result.value!.filter((p) => p.name === 'no-such-project-from-txt');
		assert.equal(matched.length, 0);
		await rm(backupDir, { recursive: true, force: true });
	});
});

describe('loadProjectConfig', () => {
	before(async () => {
		await mkdir(PROJECTS_DIR, { recursive: true });
		await writeFile(testYmlPath('load-valid'), VALID_YAML, 'utf-8');
		await writeFile(testYmlPath('load-invalid'), INVALID_YAML, 'utf-8');
	});

	after(async () => {
		await rm(testYmlPath('load-valid'), { force: true });
		await rm(testYmlPath('load-invalid'), { force: true });
	});

	it('returns parsed config for a valid project file', async () => {
		const result = await loadProjectConfig(testName('load-valid'));
		assert.ok(result.ok);
		assert.ok(result.value);
		assert.equal(result.value!.name, 'test-project');
		assert.equal(result.value!.workdir, '/tmp/test');
	});

	it('returns error for invalid project yaml', async () => {
		const result = await loadProjectConfig(testName('load-invalid'));
		assert.ok(!result.ok);
		if (!result.ok) assert.ok(result.error instanceof Error);
	});

	it('returns null for non-existent project name', async () => {
		const result = await loadProjectConfig(`${PREFIX}nonexistent_xyz`);
		assert.ok(result.ok);
		assert.equal(result.value, null);
	});
});
