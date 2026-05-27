import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { VcsAdapter, PullRequest } from '~/types/vcs.ts';
import type { Result } from '~/types/result.ts';

const execFileAsync = promisify(execFile);

export class GitHubAdapter implements VcsAdapter {
	async createPullRequest(options: {
		title: string;
		body: string;
		head: string;
		base?: string;
		workdir?: string;
		signal?: AbortSignal;
	}): Promise<Result<PullRequest>> {
		try {
			const args = [
				'pr',
				'create',
				'--title',
				options.title,
				'--body',
				options.body,
				'--head',
				options.head,
			];
			if (options.base) {
				args.push('--base', options.base);
			}

			const execOpts: { signal?: AbortSignal; cwd?: string } = {};
			if (options.signal) execOpts.signal = options.signal;
			if (options.workdir) execOpts.cwd = options.workdir;

			let stdout: string;
			try {
				const res = await execFileAsync('gh', args, execOpts);
				stdout = res.stdout;
			} catch (e) {
				const err = e as { message?: string; stderr?: string };
				const combined = `${err.message ?? ''}\n${err.stderr ?? ''}`;
				if (/Could not resolve to a Repository/i.test(combined)) {
					const remoteRes = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
						...(options.workdir ? { cwd: options.workdir } : {}),
					}).catch(() => ({ stdout: '<unknown>', stderr: '' }));
					return {
						ok: false,
						error: new Error(
							`gh pr create failed: GitHub does not recognize this repository.\n` +
								`  Workdir:      ${options.workdir ?? process.cwd()}\n` +
								`  Local remote: ${remoteRes.stdout.trim()}\n` +
								`  Checklist:\n` +
								`    - Does the repo exist on GitHub under that org/name?\n` +
								`    - Is your gh auth pointing to the right account? Run: gh auth status\n` +
								`    - Update the git remote if needed: git remote set-url origin <url>`
						),
					};
				}
				throw e;
			}
			const urlMatch = stdout.match(/https:\/\/[^\s]*\/pull\/\d+/);
			const url = urlMatch?.[0] ?? stdout.trim().split('\n').pop() ?? '';

			const numberMatch = url.match(/\/pull\/(\d+)/);
			const prNumber = numberMatch?.[1] ? parseInt(numberMatch[1], 10) : 0;

			return {
				ok: true,
				value: {
					number: prNumber,
					url,
					title: options.title,
					body: options.body,
					headBranch: options.head,
					baseBranch: options.base ?? 'main',
				},
			};
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}

	async addComment(prNumber: number, body: string, signal?: AbortSignal): Promise<Result<void>> {
		try {
			await execFileAsync('gh', ['pr', 'comment', String(prNumber), '--body', body], {
				signal: signal ?? undefined,
			});
			return { ok: true, value: undefined };
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}

	async detectRemote(): Promise<Result<{ type: 'github' | 'gitlab'; org: string; repo: string }>> {
		try {
			const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin']);
			const url = stdout.trim();

			const sshMatch = url.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
			if (sshMatch?.[1] && sshMatch[2]) {
				return {
					ok: true,
					value: { type: 'github', org: sshMatch[1], repo: sshMatch[2] },
				};
			}

			const httpsMatch = url.match(/https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
			if (httpsMatch?.[1] && httpsMatch[2]) {
				return {
					ok: true,
					value: { type: 'github', org: httpsMatch[1], repo: httpsMatch[2] },
				};
			}

			return { ok: false, error: new Error('Could not parse GitHub remote URL') };
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}

	async mergePR(prNumber: number, signal?: AbortSignal): Promise<Result<void>> {
		try {
			await execFileAsync('gh', ['pr', 'merge', String(prNumber), '--squash', '--delete-branch'], {
				signal: signal ?? undefined,
			});
			return { ok: true, value: undefined };
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}
}
