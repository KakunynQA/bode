import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gatherContext, validateWorkdir } from '~/config/context.ts';
import type { ProjectConfig } from '~/config/schema.ts';

describe('gatherContext', () => {
	const BASE = join(tmpdir(), 'bode-test-ctx-' + process.pid);

	before(async () => {
		await mkdir(BASE, { recursive: true });
	});

	after(async () => {
		await rm(BASE, { recursive: true, force: true });
	});

	it('returns undefined agentsMd when no context files exist', async () => {
		const emptyDir = join(BASE, 'empty');
		await mkdir(emptyDir, { recursive: true });
		const project: ProjectConfig = { name: 't', workdir: emptyDir };
		const ctx = await gatherContext(project);
		assert.equal(ctx.agentsMd, undefined);
	});

	it('returns agentsMd content when AGENTS.md exists', async () => {
		const dir = join(BASE, 'with-agents');
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, 'AGENTS.md'), 'Do things right.', 'utf-8');
		const project: ProjectConfig = { name: 't', workdir: dir };
		const ctx = await gatherContext(project);
		assert.ok(ctx.agentsMd);
		assert.ok(ctx.agentsMd!.includes('Do things right.'));
		assert.ok(ctx.agentsMd!.includes('### AGENTS.md'));
	});

	it('returns fileTree when directory has files', async () => {
		const dir = join(BASE, 'with-files');
		await mkdir(join(dir, 'src'), { recursive: true });
		await writeFile(join(dir, 'src', 'index.ts'), 'export {}', 'utf-8');
		await writeFile(join(dir, 'package.json'), '{}', 'utf-8');
		const project: ProjectConfig = { name: 't', workdir: dir };
		const ctx = await gatherContext(project);
		assert.ok(ctx.fileTree);
		assert.ok(ctx.fileTree!.includes('src/'));
		assert.ok(ctx.fileTree!.includes('index.ts'));
		assert.ok(ctx.fileTree!.includes('package.json'));
	});

	it('skips node_modules and .git in file tree', async () => {
		const dir = join(BASE, 'skip-dirs');
		await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true });
		await mkdir(join(dir, '.git', 'objects'), { recursive: true });
		await mkdir(join(dir, 'src'), { recursive: true });
		await writeFile(join(dir, 'node_modules', 'pkg', 'index.js'), '{}', 'utf-8');
		await writeFile(join(dir, '.git', 'objects', 'abc'), '', 'utf-8');
		await writeFile(join(dir, 'src', 'app.ts'), '', 'utf-8');
		const project: ProjectConfig = { name: 't', workdir: dir };
		const ctx = await gatherContext(project);
		assert.ok(ctx.fileTree);
		assert.ok(!ctx.fileTree!.includes('node_modules'));
		assert.ok(!ctx.fileTree!.includes('.git'));
		assert.ok(ctx.fileTree!.includes('src/'));
	});

	it('respects context_files override', async () => {
		const dir = join(BASE, 'ctx-files');
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, 'AGENTS.md'), 'default content', 'utf-8');
		await writeFile(join(dir, 'CUSTOM.md'), 'custom content', 'utf-8');
		const project: ProjectConfig = {
			name: 't',
			workdir: dir,
			context_files: ['CUSTOM.md'],
		};
		const ctx = await gatherContext(project);
		assert.ok(ctx.agentsMd);
		assert.ok(ctx.agentsMd!.includes('custom content'));
		assert.ok(!ctx.agentsMd!.includes('default content'));
	});

	it('respects context_paths to limit tree scope', async () => {
		const dir = join(BASE, 'ctx-paths');
		await mkdir(join(dir, 'src'), { recursive: true });
		await mkdir(join(dir, 'docs'), { recursive: true });
		await writeFile(join(dir, 'src', 'app.ts'), '', 'utf-8');
		await writeFile(join(dir, 'docs', 'readme.md'), '', 'utf-8');
		const project: ProjectConfig = {
			name: 't',
			workdir: dir,
			context_paths: ['src'],
		};
		const ctx = await gatherContext(project);
		assert.ok(ctx.fileTree);
		assert.ok(ctx.fileTree!.includes('app.ts'));
		assert.ok(!ctx.fileTree!.includes('docs'));
	});
});

describe('validateWorkdir', () => {
	it('returns ok:true for existing directory', async () => {
		const result = await validateWorkdir(tmpdir());
		assert.ok(result.ok);
		if (result.ok) assert.equal(result.value, undefined);
	});

	it('returns ok:false for non-existent path', async () => {
		const result = await validateWorkdir('/nonexistent/bode-test-xyz-12345');
		assert.ok(!result.ok);
		if (!result.ok) assert.ok(result.error instanceof Error);
	});

	it('returns ok:false for a file path (not a directory)', async () => {
		const file = join(tmpdir(), 'bode-validate-file-' + process.pid);
		await writeFile(file, 'x', 'utf-8');
		try {
			const result = await validateWorkdir(file);
			assert.ok(!result.ok);
			if (!result.ok) assert.ok(result.error instanceof Error);
		} finally {
			await import('node:fs/promises').then((fs) => fs.rm(file, { force: true }));
		}
	});
});
