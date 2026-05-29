import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import type { PhaseStatus } from '~/types/phase.ts';
import { getNextPhase, getPhaseStatusLabel } from '~/types/phase.ts';
import type { IssueTrackerStrategy } from '~/types/issue-tracker.ts';
import { loadRunMeta, saveRunMeta, type RunMeta } from '~/storage/run-meta.ts';
import { runPhase, type PhaseRunResult } from './phase-runner.ts';
import { validateContract } from './contract.ts';
import { runValidationGate } from './validation-gate.ts';
import { runReleaseGate } from './release-gate.ts';
import { resolveVcsProvider } from '~/config/loader.ts';
import { resolveJiraTransition } from '~/config/transitions.ts';
import { printPhaseArtifacts } from '~/cli/summary.ts';
import { getPhaseNameForStatus } from '~/types/phase.ts';
import { runHook, type HookPoint } from './hooks.ts';
import type { Result } from '~/types/result.ts';
import pc from 'picocolors';
import ora from 'ora';

export type AdvanceResult =
	| { kind: 'phase'; meta: RunMeta; phaseResult: PhaseRunResult }
	| { kind: 'pr-created'; meta: RunMeta; prUrl: string }
	| { kind: 'conflict'; meta: RunMeta }
	| { kind: 'no-op'; meta: RunMeta };

export type AdvanceOptions = {
	projectRoot: string | undefined;
	signal: AbortSignal | undefined;
	autopilot: boolean | undefined;
	projectConfig?: ProjectConfig | undefined;
	interactive?: boolean;
	dangerousBypass?: boolean;
	strict?: boolean;
	noBudget?: boolean;
};

export async function advancePhase(
	taskKey: string,
	config: BodeConfig,
	tracker: IssueTrackerStrategy,
	options: AdvanceOptions
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
		const gate = await runPrePrGates(taskKey, config, options);
		if (!gate.ok) return gate;
		return await advanceToAwaitingMerge(taskKey, meta, config, tracker, options);
	}

	const executingStatus = getExecutingStatus(nextStatus);
	if (!executingStatus) {
		return {
			ok: false,
			error: new Error(`Cannot determine executing status for next phase: ${nextStatus}`),
		};
	}

	await saveRunMeta({ ...meta, status: executingStatus });

	const interactive = options.interactive ?? true;
	const spinner = interactive
		? null
		: ora(`Running ${getPhaseStatusLabel(executingStatus)} phase...`).start();

	const phaseName = getPhaseNameForStatus(executingStatus);
	const workdir = options.projectConfig?.workdir ?? options.projectRoot ?? process.cwd();
	if (phaseName) {
		const prePoint = `pre_${phaseName}` as HookPoint;
		const preHook = await runHook(
			prePoint,
			{ taskKey, phase: phaseName, workdir },
			config,
			options.projectConfig
		);
		if (!preHook.ok) {
			return {
				ok: false,
				error: new Error(
					`Hook ${prePoint} failed: ${preHook.failedCommand}\n  ${preHook.error.message}`
				),
			};
		}
	}

	const transitionResult = await transitionForPhase(
		taskKey,
		executingStatus,
		tracker,
		config,
		options.projectConfig
	);
	if (!transitionResult.ok) {
		console.warn(pc.yellow(`[bode] Tracker transition skipped: ${transitionResult.error.message}`));
		console.warn(
			pc.dim(
				'  Configure tracker transitions in your project YAML (or global config) to match your workflow.'
			)
		);
	}

	const phaseResult = await runPhase(taskKey, executingStatus, config, tracker, {
		projectRoot: options.projectRoot,
		signal: options.signal,
		projectConfig: options.projectConfig,
		interactive,
		dangerousBypass: options.dangerousBypass ?? false,
		noBudget: options.noBudget ?? false,
	});

	if (!phaseResult.ok) {
		spinner?.fail(`Phase failed: ${phaseResult.error.message}`);
		await postTrackerComment(
			taskKey,
			tracker,
			`**[Bode] Phase ${getPhaseStatusLabel(executingStatus)} failed**\n\n${phaseResult.error.message}`
		);
		return phaseResult;
	}

	const result = phaseResult.value;

	if (result.kind === 'success') {
		if (options.strict) {
			const contract = validateContract(result.artifact);
			if (!contract.ok) {
				return {
					ok: false,
					error: new Error(`Artifact contract invalid: ${contract.errors.join('; ')}`),
				};
			}
		}

		if (executingStatus === 'reviewing-plan' && /CHANGES REQUESTED/i.test(result.artifact)) {
			await saveRunMeta({ ...meta, status: 'planning', updatedAt: Date.now() });
			return {
				ok: false,
				error: new Error('Plan review requested changes; returning to planning.'),
			};
		}

		spinner?.succeed(
			`${getPhaseStatusLabel(nextStatus)} complete (${formatDuration(result.durationMs)})`
		);

		if (phaseName) {
			await printPhaseArtifacts(taskKey, phaseName);
			const postPoint = `post_${phaseName}` as HookPoint;
			const postHook = await runHook(
				postPoint,
				{ taskKey, phase: phaseName, workdir },
				config,
				options.projectConfig
			);
			if (!postHook.ok) {
				console.warn(
					pc.yellow(`[hook ${postPoint}] failed: ${postHook.failedCommand} — continuing.`)
				);
			}
		}

		await postPhaseSummary(
			taskKey,
			executingStatus,
			result.artifact,
			result.durationMs,
			config,
			tracker
		);
	} else if (result.kind === 'missing-artifact') {
		spinner?.warn(
			`${getPhaseStatusLabel(executingStatus)} session ended without writing the artifact.`
		);
	} else if (result.kind === 'failed') {
		spinner?.fail(`Phase failed: ${result.reason}`);
		await postTrackerComment(
			taskKey,
			tracker,
			`**[Bode] Phase ${getPhaseStatusLabel(executingStatus)} failed**\n\n${result.reason}`
		);
	} else {
		spinner?.warn('Phase timed out');
		await postTrackerComment(
			taskKey,
			tracker,
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
	tracker: IssueTrackerStrategy,
	options: AdvanceOptions
): Promise<Result<AdvanceResult>> {
	const workdir = options.projectConfig?.workdir ?? options.projectRoot;
	const branch = meta.branch;
	const baseBranch = meta.baseBranch;
	const provider = resolveVcsProvider(config, options.projectConfig);

	if (!workdir || !branch || !baseBranch) {
		return {
			ok: false,
			error: new Error(
				'Missing branch info. The implementation phase should have created a branch and persisted it to meta via branch.txt.'
			),
		};
	}

	console.log(pc.dim('Handing off to AI to open the pull request (with conflict check)...'));

	const issueResult = await tracker.fetchTask(taskKey, options.signal);
	const summary = issueResult.ok ? issueResult.value.summary : meta.trackerSummary;

	const { createPullRequestViaAI } = await import('./pr-creator.ts');
	const prResult = await createPullRequestViaAI({
		taskKey,
		branch,
		baseBranch,
		workdir,
		provider,
		jiraSummary: summary,
		config,
		tracker,
		...(options.projectConfig ? { projectConfig: options.projectConfig } : {}),
		...(options.signal ? { signal: options.signal } : {}),
		dangerousBypass: options.dangerousBypass ?? false,
	});
	if (!prResult.ok) {
		console.error(pc.red(`PR creation failed: ${prResult.error.message}`));
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

	const mergeTransition = resolveJiraTransition('awaiting_merge', config, options.projectConfig);
	if (mergeTransition.trim() !== '') {
		const mergeTransResult = await tracker.setStatus(taskKey, mergeTransition);
		if (!mergeTransResult.ok) {
			console.warn(
				pc.yellow(`[bode] Tracker transition skipped: ${mergeTransResult.error.message}`)
			);
			console.warn(
				pc.dim(
					'  Configure tracker transitions (awaiting_merge) in your project YAML to match your workflow.'
				)
			);
		}
	}

	await postTrackerComment(
		taskKey,
		tracker,
		`**[Bode PR]** Created: ${prResult.value.url}\nBranch: \`${branch}\` → \`${baseBranch}\``
	);

	console.log(pc.green(`PR created: ${prResult.value.url}`));

	return { ok: true, value: { kind: 'pr-created', meta: updatedMeta, prUrl: prResult.value.url } };
}

async function transitionForPhase(
	taskKey: string,
	status: PhaseStatus,
	tracker: IssueTrackerStrategy,
	config: BodeConfig,
	projectConfig?: ProjectConfig
): Promise<Result<void>> {
	const phaseName = getPhaseNameForStatus(status);
	if (!phaseName || phaseName === 'plan-review') return { ok: true, value: undefined };
	const target = resolveJiraTransition(phaseName, config, projectConfig);
	if (target.trim() === '') return { ok: true, value: undefined };
	return await tracker.setStatus(taskKey, target);
}

async function postPhaseSummary(
	taskKey: string,
	phaseStatus: PhaseStatus,
	artifact: string,
	durationMs: number,
	config: BodeConfig,
	tracker: IssueTrackerStrategy
): Promise<void> {
	const phaseLabel = getPhaseStatusLabel(phaseStatus);
	const maxChars = config.comment_format?.plan_inline_max_chars ?? 3000;
	const useEmoji = config.comment_format?.use_emoji ?? true;
	const prefix = useEmoji ? '🤖 ' : '';

	const summary = extractSummary(artifact, maxChars);
	const duration = formatDuration(durationMs);

	await postTrackerComment(
		taskKey,
		tracker,
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

async function postTrackerComment(
	taskKey: string,
	tracker: IssueTrackerStrategy,
	body: string
): Promise<void> {
	await tracker.postComment(taskKey, body);
}

function getExecutingStatus(nextStatus: PhaseStatus): PhaseStatus | null {
	switch (nextStatus) {
		case 'planning':
			return 'planning';
		case 'planned':
			return 'planning';
		case 'reviewing-plan':
			return 'reviewing-plan';
		case 'plan-reviewed':
			return 'reviewing-plan';
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

async function runPrePrGates(
	taskKey: string,
	config: BodeConfig,
	options: AdvanceOptions
): Promise<Result<void>> {
	const workdir = options.projectConfig?.workdir ?? options.projectRoot ?? process.cwd();
	const commands = options.projectConfig?.validation ?? config.validation ?? [];
	if (commands.length > 0) {
		const validation = await runValidationGate({ taskKey, workdir, commands });
		if (!validation.ok) return validation;
	}
	const release = runReleaseGate({
		workdir,
		config,
		...(options.projectConfig ? { projectConfig: options.projectConfig } : {}),
	});
	if (!release.ok) return release;
	return { ok: true, value: undefined };
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
}

export const __testing = { getExecutingStatus, extractSummary, formatDuration };
