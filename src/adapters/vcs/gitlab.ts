import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { VcsAdapter, PullRequest } from '~/types/vcs.ts';
import type { Result } from '~/types/result.ts';

const execFileAsync = promisify(execFile);

export class GitLabAdapter implements VcsAdapter {
	async createPullRequest(options: {
		title: string;
		body: string;
		head: string;
		base?: string;
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

			const { stdout } = await execFileAsync('glab', args, {
				signal: options.signal ?? undefined,
			});

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

	async detectRemote(): Promise<Result<{ type: 'github' | 'gitlab'; org: string; repo: string }>> {
		try {
			const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin']);
			const url = stdout.trim();

			const sshMatch = url.match(/git@(gitlab\..+?):(.+?)\/(.+?)(?:\.git)?$/);
			if (sshMatch?.[1] && sshMatch[2] && sshMatch[3]) {
				return {
					ok: true,
					value: {
						type: 'gitlab',
						org: sshMatch[2],
						repo: sshMatch[3],
					},
				};
			}

			const httpsMatch = url.match(/https:\/\/(gitlab\..+?)\/(.+?)\/(.+?)(?:\.git)?$/);
			if (httpsMatch?.[1] && httpsMatch[2] && httpsMatch[3]) {
				return {
					ok: true,
					value: {
						type: 'gitlab',
						org: httpsMatch[2],
						repo: httpsMatch[3],
					},
				};
			}

			return { ok: false, error: new Error('Could not parse GitLab remote URL') };
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
