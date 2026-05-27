import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import type { PhaseStatus } from '~/types/phase.ts';
import { getNextPhase, getPhaseStatusLabel } from '~/types/phase.ts';
import type { JiraAdapter } from '~/types/jira.ts';
import { loadRunMeta, saveRunMeta, type RunMeta } from '~/storage/run-meta.ts';
import { runPhase, type PhaseRunResult } from './phase-runner.ts';
import { checkForConflicts, createPullRequest } from './branch-manager.ts';
import { resolveVcsProvider } from '~/config/loader.ts';
import type { Result } from '~/types/result.ts';
import ora from 'ora';

export type AdvanceResult =
	| { kind: 'phase'; meta: RunMeta; phaseResult: PhaseRunResult }
	| { kind: 'pr-created'; meta: RunMeta; prUrl: string }
	| { kind: 'conflict'; meta: RunMeta }
	| { kind: 'no-op'; meta: RunMeta };

export async function advancePhase(
	taskKey: string,
	config: BodeConfig,
	jira: JiraAdapter,
	options: {
		projectRoot: string | undefined;
		signal: AbortSignal | undefined;
		autopilot: boolean | undefined;
		projectConfig?: ProjectConfig | undefined;
	}
): Promise<Result<AdvanceResult>> {
	const metaResult = await loadRunMeta(taskKey);
	if (!metaResult.ok) return metaResult;

	const meta = metaResult.value;
	if (!meta) {
		return {
			ok: false,
			error: new Error(`No run found for ${taskKey}. Run 'bode start ${taskKey}' first.`),
		};
	}

	const nextStatus = getNextPhase(meta.status);
	if (!nextStatus) {
		return {
			ok: false,
			error: new Error(`Task ${taskKey} is already at '${meta.status}'. No next phase.`),
		};
	}

	if (nextStatus === 'awaiting-merge') {
		return await advanceToAwaitingMerge(taskKey, meta, config, jira, options);
	}

	const executingStatus = getExecutingStatus(nextStatus);
	if (!executingStatus) {
		return {
			ok: false,
			error: new Error(`Cannot determine executing status for next phase: ${nextStatus}`),
		};
	}

	await saveRunMeta({ ...meta, status: executingStatus });

	// Jira transition: move card before executing phase
	const transitionResult = await transitionJiraForStatus(taskKey, executingStatus, jira);
	if (!transitionResult.ok) {
		console.warn(`[bode] Jira transition failed: ${transitionResult.error.message}`);
	}

	const spinner = ora(`Running ${getPhaseStatusLabel(executingStatus)} phase...`).start();

	const phaseResult = await runPhase(taskKey, executingStatus, config, jira, {
		projectRoot: options.projectRoot,
		signal: options.signal,
		projectConfig: options.projectConfig,
	});

	if (!phaseResult.ok) {
		spinner.fail(`Phase failed: ${phaseResult.error.message}`);
		await postJiraComment(
			taskKey,
			jira,
			`**[Bode] Phase ${getPhaseStatusLabel(executingStatus)} failed**\n\n${phaseResult.error.message}`
		);
		return phaseResult;
	}

	const result = phaseResult.value;

	if (result.kind === 'success') {
		spinner.succeed(
			`${getPhaseStatusLabel(nextStatus)} complete (${formatDuration(result.durationMs)})`
		);

		// Post summary comment on Jira
		await postPhaseSummary(
			taskKey,
			executingStatus,
			result.artifact,
			result.durationMs,
			config,
			jira
		);
	} else if (result.kind === 'failed') {
		spinner.fail(`Phase failed: ${result.reason}`);
		await postJiraComment(
			taskKey,
			jira,
			`**[Bode] Phase ${getPhaseStatusLabel(executingStatus)} failed**\n\n${result.reason}`
		);
	} else {
		spinner.warn('Phase timed out');
		await postJiraComment(
			taskKey,
			jira,
			`**[Bode] Phase ${getPhaseStatusLabel(executingStatus)} timed out**`
		);
	}

	const updatedMeta = await loadRunMeta(taskKey);
	if (!updatedMeta.ok || !updatedMeta.value) {
		return { ok: false, error: new Error('Failed to load updated run meta') };
	}

	return { ok: true, value: { kind: 'phase', meta: updatedMeta.value, phaseResult: result } };
}

async function advanceToAwaitingMerge(
	taskKey: string,
	meta: RunMeta,
	config: BodeConfig,
	jira: JiraAdapter,
	options: {
		projectRoot: string | undefined;
		signal: AbortSignal | undefined;
		projectConfig?: ProjectConfig | undefined;
	}
): Promise<Result<AdvanceResult>> {
	const workdir = options.projectConfig?.workdir ?? options.projectRoot;
	const branch = meta.branch;
	const baseBranch = meta.baseBranch;
	const provider = resolveVcsProvider(config, options.projectConfig);

	if (!workdir || !branch || !baseBranch) {
		return {
			ok: false,
			error: new Error('Missing branch info. Cannot check for conflicts or create PR.'),
		};
	}

	const spinner = ora('Checking for conflicts...').start();

	const conflictResult = await checkForConflicts(workdir, baseBranch, branch, options.signal);
	if (!conflictResult.ok) {
		spinner.fail(`Conflict check failed: ${conflictResult.error.message}`);
		return conflictResult;
	}

	if (conflictResult.value) {
		spinner.warn('Conflicts detected!');

		const updatedMeta: RunMeta = {
			...meta,
			status: 'awaiting-merge',
			conflict: true,
			updatedAt: Date.now(),
		};
		await saveRunMeta(updatedMeta);

		const labels = config.jira_labels;
		if (labels) {
			await jira.addLabel(taskKey, 'bode:conflict');
		}

		await postJiraComment(
			taskKey,
			jira,
			`**[Bode Conflict]** Conflicts detected with \`${baseBranch}\`. Manual resolution required.`
		);

		return { ok: true, value: { kind: 'conflict', meta: updatedMeta } };
	}

	spinner.text = 'Creating pull request...';

	const issueResult = await jira.getIssue(taskKey, options.signal);
	const summary = issueResult.ok ? issueResult.value.summary : meta.jiraSummary;

	const prResult = await createPullRequest(
		workdir,
		taskKey,
		summary,
		branch,
		baseBranch,
		provider,
		options.signal
	);
	if (!prResult.ok) {
		spinner.fail(`PR creation failed: ${prResult.error.message}`);
		return prResult;
	}

	const updatedMeta: RunMeta = {
		...meta,
		status: 'awaiting-merge',
		prUrl: prResult.value.url,
		prNumber: prResult.value.number,
		updatedAt: Date.now(),
	};
	await saveRunMeta(updatedMeta);

	// Transition Jira to "Code Review"
	await jira.transitionStatus(taskKey, 'Code Review');

	// Post PR comment on Jira
	await postJiraComment(
		taskKey,
		jira,
		`**[Bode PR]** Created: ${prResult.value.url}\nBranch: \`${branch}\` → \`${baseBranch}\``
	);

	spinner.succeed(`PR created: ${prResult.value.url}`);

	return { ok: true, value: { kind: 'pr-created', meta: updatedMeta, prUrl: prResult.value.url } };
}

async function transitionJiraForStatus(
	taskKey: string,
	status: PhaseStatus,
	jira: JiraAdapter
): Promise<Result<void>> {
	const transitionMap: Partial<Record<PhaseStatus, string>> = {
		planning: 'In Progress',
		implementing: 'In Review',
		reviewing: 'Code Review',
	};

	const transition = transitionMap[status];
	if (transition) {
		return await jira.transitionStatus(taskKey, transition);
	}
	return { ok: true, value: undefined };
}

async function postPhaseSummary(
	taskKey: string,
	phaseStatus: PhaseStatus,
	artifact: string,
	durationMs: number,
	config: BodeConfig,
	jira: JiraAdapter
): Promise<void> {
	const phaseLabel = getPhaseStatusLabel(phaseStatus);
	const maxChars = config.comment_format?.plan_inline_max_chars ?? 3000;
	const useEmoji = config.comment_format?.use_emoji ?? true;
	const prefix = useEmoji ? '🤖 ' : '';

	const summary = extractSummary(artifact, maxChars);
	const duration = formatDuration(durationMs);

	await postJiraComment(
		taskKey,
		jira,
		`**${prefix}[Bode ${phaseLabel}]** Completed in ${duration}.\n\n${summary}`
	);
}

function extractSummary(artifact: string, maxChars: number): string {
	if (artifact.length <= maxChars) return artifact;

	const lines = artifact.split('\n');
	const summaryLines: string[] = [];
	let totalLen = 0;

	for (const line of lines) {
		if (totalLen + line.length + 1 > maxChars - 50) break;
		summaryLines.push(line);
		totalLen += line.length + 1;
	}

	return (
		summaryLines.join('\n') +
		'\n\n...(_truncated. Run `bode show <phase> <TASK-KEY>` for full output_)'
	);
}

async function postJiraComment(taskKey: string, jira: JiraAdapter, body: string): Promise<void> {
	await jira.addComment(taskKey, body);
}

function getExecutingStatus(nextStatus: PhaseStatus): PhaseStatus | null {
	switch (nextStatus) {
		case 'planning':
			return 'planning';
		case 'planned':
			return 'planning';
		case 'implementing':
			return 'implementing' as PhaseStatus;
		case 'reviewing':
			return 'implementing' as PhaseStatus;
		case 'reviewed':
			return 'reviewing';
		default:
			return null;
	}
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
}
