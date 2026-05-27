import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { VcsAdapter, PullRequest } from '~/types/vcs.ts';
import type { Result } from '~/types/result.ts';

const execFileAsync = promisify(execFile);

/**
 * GitHub VCS adapter. As of v0.18.0, bode does not create PRs directly —
 * the AI does that during the awaiting-merge handoff via its own `gh` tool
 * call. The methods below remain for `bode done --auto-approve-pr-merge`
 * (mergePR) and the rare programmatic case where someone wants to add a PR
 * comment from bode itself. None of them shell out to `git`.
 */
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
					return {
						ok: false,
						error: new Error(
							`gh pr create failed: GitHub does not recognize this repository.\n` +
								`  Workdir: ${options.workdir ?? process.cwd()}\n` +
								`  Checklist:\n` +
								`    - Does the repo exist on GitHub under the right org/name?\n` +
								`    - Is your gh auth pointing to the right account? Run: gh auth status\n` +
								`    - If the local git remote is wrong, fix with: git remote set-url origin <url>`
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
