import type { Result } from '~/types/result.ts';
import type { VcsProvider } from '~/types/vcs.ts';
import {
	createBranch,
	checkout,
	pushBranch,
	deleteBranch,
	fetchRemote,
	isAncestor,
	hasConflicts,
	isClean,
	getCurrentBranch,
} from '~/adapters/vcs/git.ts';
import { createVcsAdapter } from '~/adapters/vcs/factory.ts';

const ISSUE_TYPE_TO_PREFIX: Record<string, string> = {
	story: 'feat',
	'user story': 'feat',
	bug: 'fix',
	task: 'chore',
	improvement: 'refactor',
	'sub-task': 'feat',
	epic: 'feat',
	spike: 'chore',
};

export function branchNameForTask(taskKey: string, issueType: string): string {
	const prefix = ISSUE_TYPE_TO_PREFIX[issueType.toLowerCase()] ?? 'feat';
	return `${prefix}/${taskKey.toLowerCase()}`;
}

export async function startBranch(
	workdir: string,
	taskKey: string,
	issueType: string,
	baseBranch: string,
	signal?: AbortSignal
): Promise<Result<string>> {
	const cleanResult = await isClean(workdir);
	if (!cleanResult.ok) return cleanResult;
	if (!cleanResult.value) {
		return {
			ok: false,
			error: new Error('Working directory is not clean. Commit or stash changes first.'),
		};
	}

	const branchName = branchNameForTask(taskKey, issueType);

	const createResult = await createBranch(workdir, branchName, baseBranch, signal);
	if (!createResult.ok) return createResult;

	const pushResult = await pushBranch(workdir, branchName, signal);
	if (!pushResult.ok) {
		return {
			ok: false,
			error: new Error(`Branch created locally but push failed: ${pushResult.error.message}`),
		};
	}

	return { ok: true, value: branchName };
}

export async function checkForConflicts(
	workdir: string,
	baseBranch: string,
	taskBranch: string,
	signal?: AbortSignal
): Promise<Result<boolean>> {
	const fetchResult = await fetchRemote(workdir, 'origin', signal);
	if (!fetchResult.ok) return fetchResult;

	const ancestorResult = await isAncestor(workdir, `origin/${baseBranch}`, taskBranch);
	if (!ancestorResult.ok) return ancestorResult;

	if (ancestorResult.value) {
		return { ok: true, value: false };
	}

	const conflictResult = await hasConflicts(workdir, `origin/${baseBranch}`, taskBranch);
	if (!conflictResult.ok) return conflictResult;

	return { ok: true, value: conflictResult.value };
}

export async function createPullRequest(
	workdir: string,
	taskKey: string,
	summary: string,
	branch: string,
	baseBranch: string,
	provider: VcsProvider,
	signal?: AbortSignal
): Promise<Result<{ number: number; url: string }>> {
	const vcs = createVcsAdapter(provider);

	const prResult = await vcs.createPullRequest({
		title: `${taskKey}: ${summary}`,
		body: `Automated PR created by Bode for ${taskKey}.\n\n## Summary\n${summary}\n\n---\n_Powered by Bode_`,
		head: branch,
		base: baseBranch,
		workdir,
		...(signal ? { signal } : {}),
	});

	if (!prResult.ok) return prResult;

	return { ok: true, value: { number: prResult.value.number, url: prResult.value.url } };
}

export async function switchToBase(workdir: string, baseBranch: string): Promise<Result<void>> {
	return checkout(workdir, baseBranch);
}

export async function cleanupBranch(
	workdir: string,
	branch: string,
	baseBranch: string
): Promise<Result<void>> {
	const switchResult = await checkout(workdir, baseBranch);
	if (!switchResult.ok) return switchResult;

	return deleteBranch(workdir, branch);
}

export async function getCurrentBranchName(workdir: string): Promise<Result<string>> {
	return getCurrentBranch(workdir);
}

export async function mergePR(
	prNumber: number,
	provider: VcsProvider,
	signal?: AbortSignal
): Promise<Result<void>> {
	const vcs = createVcsAdapter(provider);
	return vcs.mergePR(prNumber, signal);
}
