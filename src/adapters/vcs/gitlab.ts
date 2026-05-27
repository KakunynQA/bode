import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { VcsAdapter, PullRequest } from '~/types/vcs.ts';
import type { Result } from '~/types/result.ts';

const execFileAsync = promisify(execFile);

/**
 * GitLab VCS adapter. Mirror of GitHubAdapter — as of v0.18.0, bode does not
 * shell out to git. The MR is opened by the AI; bode's `mergePR` is invoked
 * by `bode done --auto-approve-pr-merge` and uses `glab` (not git).
 */
export class GitLabAdapter implements VcsAdapter {
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
				'mr',
				'create',
				'--title',
				options.title,
				'--description',
				options.body,
				'--source-branch',
				options.head,
				'--target-branch',
				options.base ?? 'main',
				'--no-editor',
			];

			const execOpts: { signal?: AbortSignal; cwd?: string } = {};
			if (options.signal) execOpts.signal = options.signal;
			if (options.workdir) execOpts.cwd = options.workdir;

			const { stdout } = await execFileAsync('glab', args, execOpts);

			const urlMatch = stdout.match(/https:\/\/[^\s]*\/-\/merge_requests\/\d+/);
			const url = urlMatch?.[0] ?? stdout.trim().split('\n').pop() ?? '';
			const numberMatch = url.match(/\/merge_requests\/(\d+)/);
			const mrNumber = numberMatch?.[1] ? parseInt(numberMatch[1], 10) : 0;

			return {
				ok: true,
				value: {
					number: mrNumber,
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
			await execFileAsync('glab', ['mr', 'note', String(prNumber), '--message', body], {
				signal: signal ?? undefined,
			});
			return { ok: true, value: undefined };
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}

	async mergePR(prNumber: number, signal?: AbortSignal): Promise<Result<void>> {
		try {
			await execFileAsync('glab', ['mr', 'merge', String(prNumber), '--squash', '--yes'], {
				signal: signal ?? undefined,
			});
			return { ok: true, value: undefined };
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}
}
