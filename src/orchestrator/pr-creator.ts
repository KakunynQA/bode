import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readText, writeText } from '~/utils/fs.ts';
import { getRunDir } from '~/config/defaults.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import type { IssueTrackerStrategy } from '~/types/issue-tracker.ts';
import type { Result } from '~/types/result.ts';
import type { VcsProvider } from '~/types/vcs.ts';

export type AiPrResult = {
	url: string;
	number: number;
	bodyArtifactPath: string;
};

/**
 * Create the PR/MR via the user's AI CLI instead of bode shelling out
 * directly to `gh` / `glab`. The AI has full context (planning + impl +
 * review artifacts) and crafts a meaningful title and description.
 *
 * Handoff contract: the AI writes the final PR URL on a single line to
 *   ~/.bode/runs/<KEY>/pr.txt
 * Bode reads that file after the AI exits, extracts URL + number, and
 * persists them in run meta.
 */
export async function createPullRequestViaAI(args: {
	taskKey: string;
	branch: string;
	baseBranch: string;
	workdir: string;
	provider: VcsProvider;
	jiraSummary: string;
	config: BodeConfig;
	tracker: IssueTrackerStrategy;
	projectConfig?: ProjectConfig | undefined;
	signal?: AbortSignal | undefined;
	dangerousBypass?: boolean;
}): Promise<Result<AiPrResult>> {
	const runDir = getRunDir(args.taskKey);
	const prFile = join(runDir, 'pr.txt');
	const logPath = join(runDir, 'pr.log');

	// Pre-clear pr.txt so the AI doesn't pick up a stale URL from a prior run.
	if (existsSync(prFile)) {
		await writeText(prFile, '');
	}

	const planning = (await readText(join(runDir, 'planning.md'))) ?? '(no plan artifact)';
	const implementation =
		(await readText(join(runDir, 'implementation.md'))) ?? '(no implementation artifact)';
	const review = (await readText(join(runDir, 'review.md'))) ?? '(no review artifact)';

	const tool = args.provider === 'gitlab' ? 'glab' : 'gh';
	const createCmd =
		args.provider === 'gitlab'
			? `glab mr create --source-branch ${args.branch} --target-branch ${args.baseBranch} --title <title> --description <body> --no-editor`
			: `gh pr create --head ${args.branch} --base ${args.baseBranch} --title <title> --body <body>`;

	const prompt = buildPrPrompt({
		taskKey: args.taskKey,
		summary: args.jiraSummary,
		branch: args.branch,
		baseBranch: args.baseBranch,
		workdir: args.workdir,
		tool,
		createCmd,
		prFile,
		planning,
		implementation,
		review,
	});

	// Use the review phase's adapter — it's the latest one and has full context.
	const phaseConfig = args.config.phases.review;
	const adapterResult = getAdapter(phaseConfig.cli);
	if (!adapterResult.ok) return adapterResult;

	const invokeResult = await adapterResult.value.invoke(
		prompt,
		{
			cli: phaseConfig.cli,
			model: phaseConfig.model,
			timeout_minutes: phaseConfig.timeout_minutes,
		},
		{
			...(args.signal ? { signal: args.signal } : {}),
			interactive: true,
			dangerousBypass: args.dangerousBypass ?? false,
			workdir: args.workdir,
		}
	);

	await writeText(
		logPath,
		`PR-creation session — exit code: ${invokeResult.ok ? invokeResult.value.exitCode : 'error'}, duration: ${invokeResult.ok ? invokeResult.value.durationMs : 0}ms`
	);

	if (!invokeResult.ok) {
		return { ok: false, error: invokeResult.error };
	}

	const raw = (await readText(prFile)) ?? '';
	const url = extractPrUrl(raw, args.provider);
	if (!url) {
		return {
			ok: false,
			error: new Error(
				`AI session ended but ${prFile} did not contain a recognizable ${args.provider} PR URL.\n` +
					`  File contents: ${raw.trim() || '(empty)'}\n` +
					`  Expected: a single line with the full PR/MR URL.`
			),
		};
	}

	const number = extractPrNumber(url, args.provider);

	return {
		ok: true,
		value: {
			url,
			number,
			bodyArtifactPath: prFile,
		},
	};
}

type PromptArgs = {
	taskKey: string;
	summary: string;
	branch: string;
	baseBranch: string;
	workdir: string;
	tool: 'gh' | 'glab';
	createCmd: string;
	prFile: string;
	planning: string;
	implementation: string;
	review: string;
};

function buildPrPrompt(a: PromptArgs): string {
	return [
		`# Task: open a pull request`,
		``,
		`You have just finished planning, implementing, and reviewing ${a.taskKey}: "${a.summary}".`,
		`Your job now is to open the pull request using \`${a.tool}\` and report back the URL.`,
		``,
		`## Repo info`,
		`- Workdir:      ${a.workdir}`,
		`- Source branch: ${a.branch}`,
		`- Target branch: ${a.baseBranch}`,
		`- Tool:         ${a.tool}`,
		``,
		`## Steps`,
		`1. Conflict check FIRST. Run these in the workdir:`,
		`     git fetch origin`,
		`     git merge-base --is-ancestor origin/${a.baseBranch} HEAD`,
		`   If the second command exits non-zero (conflicts), STOP — do NOT open the PR. Report the conflicting files to the user and exit. Do not write anything to ${a.prFile}.`,
		`2. Read your own artifacts to recall what changed (already inlined below).`,
		`3. Craft a clear, specific PR title (avoid generic "${a.taskKey}: ${a.summary}" boilerplate — use what you actually did).`,
		`4. Craft a PR body in markdown that includes:`,
		`     - Summary of what changed and why`,
		`     - Notable design decisions`,
		`     - Test coverage you added or relied on`,
		`     - Anything reviewers should look at carefully`,
		`     - The review verdict if one is included`,
		`5. Run \`${a.tool}\` to create the PR. Example shape:`,
		`     \`${a.createCmd}\``,
		`   Run it from the workdir above — your terminal is already there.`,
		`6. After it succeeds, write ONLY the PR URL on a single line to:`,
		`     ${a.prFile}`,
		`   No extra text, no markdown, no commentary — just the URL.`,
		`7. Exit the session.`,
		``,
		`## Constraints`,
		`- Do NOT modify code, run tests, or change branches. Your only job is to open the PR.`,
		`- If the \`${a.tool}\` command fails, fix the issue (auth, remote, etc.) or report the failure and exit — do NOT loop forever.`,
		``,
		`## Planning artifact`,
		``,
		a.planning,
		``,
		`## Implementation artifact`,
		``,
		a.implementation,
		``,
		`## Review artifact`,
		``,
		a.review,
	].join('\n');
}

function extractPrUrl(text: string, provider: VcsProvider): string | null {
	const re =
		provider === 'gitlab'
			? /https:\/\/[^\s'"`]+\/-\/merge_requests\/\d+/
			: /https:\/\/[^\s'"`]+\/pull\/\d+/;
	const match = text.match(re);
	return match?.[0] ?? null;
}

function extractPrNumber(url: string, provider: VcsProvider): number {
	const re = provider === 'gitlab' ? /\/merge_requests\/(\d+)/ : /\/pull\/(\d+)/;
	const match = url.match(re);
	return match?.[1] ? parseInt(match[1], 10) : 0;
}

export const __testing = { extractPrUrl, extractPrNumber, buildPrPrompt };
