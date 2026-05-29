import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { getWorktreesDir } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';

export function worktreePathForTask(key: string): string {
	return join(getWorktreesDir(), key.toUpperCase());
}

export async function addWorktree(options: {
	repo: string;
	key: string;
	branch: string;
	baseBranch: string;
}): Promise<Result<string>> {
	const path = worktreePathForTask(options.key);
	const result = await runGit(options.repo, [
		'worktree',
		'add',
		'-b',
		options.branch,
		path,
		options.baseBranch,
	]);
	return result.ok ? { ok: true, value: path } : result;
}

export async function removeWorktree(path: string): Promise<Result<void>> {
	const result = await runGit(process.cwd(), ['worktree', 'remove', '--force', path]);
	return result.ok ? { ok: true, value: undefined } : result;
}

function runGit(cwd: string, args: string[]): Promise<Result<string>> {
	return new Promise((resolve) => {
		const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		let output = '';
		child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
		child.on('close', (code) => {
			if (code === 0) resolve({ ok: true, value: output });
			else resolve({ ok: false, error: new Error(output || `git exited ${code}`) });
		});
		child.on('error', (error) => resolve({ ok: false, error }));
	});
}
