import type { Result } from './result.ts';

export type VcsProvider = 'github' | 'gitlab';

export type PullRequest = {
	number: number;
	url: string;
	title: string;
	body: string;
	headBranch: string;
	baseBranch: string;
};

export interface VcsAdapter {
	createPullRequest(options: {
		title: string;
		body: string;
		head: string;
		base?: string;
		signal?: AbortSignal;
	}): Promise<Result<PullRequest>>;
	addComment(prNumber: number, body: string, signal?: AbortSignal): Promise<Result<void>>;
	mergePR(prNumber: number, signal?: AbortSignal): Promise<Result<void>>;
	detectRemote(): Promise<Result<{ type: 'github' | 'gitlab'; org: string; repo: string }>>;
}
