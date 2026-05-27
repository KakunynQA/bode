import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Result } from '~/types/result.ts';

const execFileAsync = promisify(execFile);

async function git(
	workdir: string,
	args: string[],
	signal?: AbortSignal
): Promise<Result<{ stdout: string; stderr: string }>> {
	try {
		const result = await execFileAsync('git', args, {
			cwd: workdir,
			signal: signal ?? undefined,
		});
		return { ok: true, value: { stdout: result.stdout.trim(), stderr: result.stderr.trim() } };
	} catch (error) {
		return { ok: false, error: error as Error };
	}
}

export async function getCurrentBranch(workdir: string): Promise<Result<string>> {
	const result = await git(workdir, ['rev-parse', '--abbrev-ref', 'HEAD']);
	if (!result.ok) return result;
	return { ok: true, value: result.value.stdout };
}

export async function createBranch(
	workdir: string,
	name: string,
	from: string,
	signal?: AbortSignal
): Promise<Result<void>> {
	const result = await git(workdir, ['checkout', '-b', name, from], signal);
	if (!result.ok)
		return {
			ok: false,
			error: new Error(`Failed to create branch ${name} from ${from}: ${result.error.message}`),
		};
	return { ok: true, value: undefined };
}

export async function checkout(
	workdir: string,
	branch: string,
	signal?: AbortSignal
): Promise<Result<void>> {
	const result = await git(workdir, ['checkout', branch], signal);
	if (!result.ok)
		return { ok: false, error: new Error(`Failed to checkout ${branch}: ${result.error.message}`) };
	return { ok: true, value: undefined };
}

export async function pushBranch(
	workdir: string,
	name: string,
	signal?: AbortSignal
): Promise<Result<void>> {
	const result = await git(workdir, ['push', '-u', 'origin', name], signal);
	if (!result.ok)
		return {
			ok: false,
			error: new Error(`Failed to push branch ${name}: ${result.error.message}`),
		};
	return { ok: true, value: undefined };
}

export async function deleteBranch(
	workdir: string,
	name: string,
	signal?: AbortSignal
): Promise<Result<void>> {
	const result = await git(workdir, ['branch', '-D', name], signal);
	if (!result.ok)
		return {
			ok: false,
			error: new Error(`Failed to delete branch ${name}: ${result.error.message}`),
		};
	return { ok: true, value: undefined };
}

export async function fetchRemote(
	workdir: string,
	remote: string,
	signal?: AbortSignal
): Promise<Result<void>> {
	const result = await git(workdir, ['fetch', remote], signal);
	if (!result.ok)
		return { ok: false, error: new Error(`Failed to fetch ${remote}: ${result.error.message}`) };
	return { ok: true, value: undefined };
}

export async function isAncestor(
	workdir: string,
	ancestor: string,
	ref: string
): Promise<Result<boolean>> {
	const result = await git(workdir, ['merge-base', '--is-ancestor', ancestor, ref]);
	if (!result.ok) return { ok: true, value: false };
	return { ok: true, value: true };
}

export async function hasConflicts(
	workdir: string,
	base: string,
	head: string
): Promise<Result<boolean>> {
	const result = await git(workdir, [
		'diff',
		'--name-only',
		'--diff-filter=U',
		`${base}...${head}`,
	]);
	if (!result.ok) return { ok: false, error: result.error };
	return { ok: true, value: result.value.stdout.length > 0 };
}

export async function branchExists(workdir: string, name: string): Promise<Result<boolean>> {
	const result = await git(workdir, ['rev-parse', '--verify', name]);
	if (!result.ok) return { ok: true, value: false };
	return { ok: true, value: true };
}

export async function stash(
	workdir: string,
	message?: string,
	signal?: AbortSignal
): Promise<Result<void>> {
	const args = ['stash', 'push'];
	if (message) args.push('-m', message);
	const result = await git(workdir, args, signal);
	if (!result.ok) return result;
	return { ok: true, value: undefined };
}

export async function isClean(workdir: string): Promise<Result<boolean>> {
	const result = await git(workdir, ['status', '--porcelain']);
	if (!result.ok) return { ok: false, error: result.error };
	return { ok: true, value: result.value.stdout.length === 0 };
}
