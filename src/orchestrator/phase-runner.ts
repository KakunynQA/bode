import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import type { PhaseName, PhaseStatus } from '~/types/phase.ts';
import { getPhaseNameForStatus, getNextPhase } from '~/types/phase.ts';
import type { IssueTrackerStrategy } from '~/types/issue-tracker.ts';
import type { CliAdapterConfig, CliInvocationOptions } from '~/types/cli-adapter.ts';
import type { Result } from '~/types/result.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { loadSkillPrompt } from '~/skills/resolver.ts';
import { buildPrompt } from '~/skills/prompt-builder.ts';
import { saveRunMeta, loadRunMeta } from '~/storage/run-meta.ts';
import { getRunDir } from '~/config/defaults.ts';
import { writeText, readText } from '~/utils/fs.ts';
import { gatherContext } from '~/config/context.ts';
import { preflightProjectPaths } from './preflight.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';

export type PhaseRunResult =
	| { kind: 'success'; artifact: string; logPath: string; durationMs: number }
	| { kind: 'failed'; reason: string; logPath: string }
	| { kind: 'missing-artifact'; logPath: string; durationMs: number }
	| { kind: 'timeout'; logPath: string };

export type RunPhaseOptions = {
	projectRoot: string | undefined;
	signal: AbortSignal | undefined;
	projectConfig?: ProjectConfig | undefined;
	interactive?: boolean;
	dangerousBypass?: boolean;
};

export async function runPhase(
	taskKey: string,
	status: PhaseStatus,
	config: BodeConfig,
	tracker: IssueTrackerStrategy,
	options: RunPhaseOptions
): Promise<Result<PhaseRunResult>> {
	const phaseName = getPhaseNameForStatus(status);
	if (!phaseName) {
		return { ok: false, error: new Error(`No phase name for status: ${status}`) };
	}

	const phaseConfig =
		phaseName === 'plan-review' ? config.phases.plan_review : config.phases[phaseName];
	if (!phaseConfig) {
		return { ok: false, error: new Error(`No config for phase: ${phaseName}`) };
	}

	const adapterResult = getAdapter(phaseConfig.cli);
	if (!adapterResult.ok) return adapterResult;

	if (options.projectConfig) {
		const preflight = await preflightProjectPaths(options.projectConfig);
		if (!preflight.ok) {
			return { ok: false, error: new Error(preflight.error.message) };
		}
	}

	const skillResult = await loadSkillPrompt(phaseName, {
		projectRoot: options.projectRoot,
		globalDir: undefined,
		cli: phaseConfig.cli,
	});
	if (!skillResult.ok) return skillResult;

	const issueResult = await tracker.fetchTask(taskKey, options.signal);
	if (!issueResult.ok) return issueResult;
	const issue = issueResult.value;

	const priorPhaseFile = getPriorPhaseFile(phaseName);
	const priorArtifact = priorPhaseFile
		? ((await readText(join(getRunDir(taskKey), priorPhaseFile))) ?? undefined)
		: undefined;

	let projectAgentsMd: string | undefined;
	let repoFileTree: string | undefined;

	if (options.projectConfig) {
		const ctx = await gatherContext(options.projectConfig);
		projectAgentsMd = ctx.agentsMd;
		repoFileTree = ctx.fileTree;
	}

	const repos = options.projectConfig?.repos?.map((r) => {
		const entry: { workdir: string; name?: string } = { workdir: r.workdir };
		if (r.name) entry.name = r.name;
		return entry;
	});

	const runDir = getRunDir(taskKey);
	const logPath = join(runDir, `${phaseName}.log`);
	const artifactPath = join(runDir, `${phaseName}.md`);
	const branchFile = join(runDir, 'branch.txt');

	// Load current branch + base branch from meta so the prompt can tell the AI.
	const currentMetaResult = await loadRunMeta(taskKey);
	const currentMeta = currentMetaResult.ok ? currentMetaResult.value : null;
	const baseBranch = currentMeta?.baseBranch;
	const currentBranch = currentMeta?.branch;

	const prompt = buildPrompt(skillResult.value, {
		jiraIssue: issue,
		projectAgentsMd,
		repoFileTree,
		priorArtifact,
		artifactPath,
		branchFile,
		phaseName,
		...(baseBranch ? { baseBranch } : {}),
		...(currentBranch ? { currentBranch } : {}),
		...(repos ? { repos } : {}),
		...(options.projectConfig?.branch_tool
			? { branchTool: options.projectConfig.branch_tool }
			: {}),
		...(options.projectRoot ? { mainWorkdir: options.projectRoot } : {}),
	});

	const cliConfig: CliAdapterConfig = {
		cli: phaseConfig.cli,
		model: phaseConfig.model,
		timeout_minutes: phaseConfig.timeout_minutes,
	};

	const labels = config.jira_labels;
	const currentLabelKey = getCurrentLabelKey(phaseName);
	if (labels && currentLabelKey) {
		await tracker.addTag(taskKey, labels[currentLabelKey]);
	}

	const invocationOpts: CliInvocationOptions = {
		signal: options.signal,
		interactive: options.interactive ?? true,
		dangerousBypass: options.dangerousBypass ?? false,
		...(options.projectConfig?.workdir ? { workdir: options.projectConfig.workdir } : {}),
	};

	const invokeResult = await adapterResult.value.invoke(prompt, cliConfig, invocationOpts);

	if (!invokeResult.ok) {
		const failLog = `Phase ${phaseName} failed: ${invokeResult.error.message}`;
		await writeText(logPath, failLog);

		const metaResult = await loadRunMeta(taskKey);
		if (metaResult.ok && metaResult.value) {
			await saveRunMeta({
				...metaResult.value,
				status: 'failed',
				error: invokeResult.error.message,
			});
		}

		return {
			ok: true,
			value: { kind: 'failed', reason: invokeResult.error.message, logPath },
		};
	}

	const invocation = invokeResult.value;

	if (invocation.stdout || invocation.stderr) {
		const logBody = `STDOUT:\n${invocation.stdout}\n\nSTDERR:\n${invocation.stderr}`;
		await writeText(logPath, logBody);
	} else {
		await writeText(
			logPath,
			`Interactive session — output not captured. Exit code: ${invocation.exitCode}. Duration: ${invocation.durationMs}ms.`
		);
	}

	// Exit code gate (B1 from analysis, issue #1):
	// If the AI CLI exited non-zero, the phase failed regardless of whether an
	// artifact happens to exist on disk. Treat as a hard failure.
	if (invocation.exitCode !== 0) {
		const reason = `${phaseConfig.cli} exited with code ${invocation.exitCode}${
			invocation.stderr ? `\n${invocation.stderr.trim().slice(-500)}` : ''
		}`;
		const metaResult = await loadRunMeta(taskKey);
		if (metaResult.ok && metaResult.value) {
			await saveRunMeta({ ...metaResult.value, status: 'failed', error: reason });
		}
		return {
			ok: true,
			value: { kind: 'failed', reason, logPath },
		};
	}

	const artifact = await readArtifact(artifactPath, invocation.stdout);

	if (!artifact) {
		return {
			ok: true,
			value: { kind: 'missing-artifact', logPath, durationMs: invocation.durationMs },
		};
	}

	// Only persist artifact when AI did not write it (headless fallback).
	if (!existsSync(artifactPath)) {
		await writeText(artifactPath, artifact);
	}

	const labelsConfig = config.jira_labels;
	if (labelsConfig) {
		if (currentLabelKey) {
			await tracker.removeTag(taskKey, labelsConfig[currentLabelKey]);
		}
		const nextLabelKey = getNextLabelKey(phaseName);
		if (nextLabelKey) {
			await tracker.addTag(taskKey, labelsConfig[nextLabelKey]);
		}
	}

	// v0.18.0: if the AI created/switched a branch during this phase, it writes
	// the name to <runs>/<KEY>/branch.txt as the handoff. Read it and persist
	// to meta. branch.txt may be missing on read-only phases — that's fine.
	let aiBranch: string | null = null;
	if (existsSync(branchFile)) {
		const raw = await readText(branchFile);
		const trimmed = raw?.trim();
		if (trimmed && trimmed.length > 0 && trimmed.length < 200) {
			aiBranch = trimmed;
		}
	}

	const nextStatus = getNextPhase(status);
	if (nextStatus || aiBranch) {
		const metaResult = await loadRunMeta(taskKey);
		if (metaResult.ok && metaResult.value) {
			await saveRunMeta({
				...metaResult.value,
				...(nextStatus ? { status: nextStatus } : {}),
				...(aiBranch ? { branch: aiBranch } : {}),
			});
		}
	}

	return {
		ok: true,
		value: {
			kind: 'success',
			artifact,
			logPath,
			durationMs: invocation.durationMs,
		},
	};
}

async function readArtifact(artifactPath: string, headlessStdout: string): Promise<string | null> {
	if (existsSync(artifactPath)) {
		try {
			const s = await stat(artifactPath);
			if (s.size > 0) {
				const content = await readText(artifactPath);
				if (content && content.trim().length > 0) return content;
			}
		} catch {
			// fall through to stdout fallback
		}
	}
	if (headlessStdout && headlessStdout.trim().length > 0) return headlessStdout;
	return null;
}

function getPriorPhaseFile(phase: PhaseName): string | null {
	switch (phase) {
		case 'planning':
			return '';
		case 'plan-review':
			return 'planning.md';
		case 'implementation':
			return 'plan-review.md';
		case 'review':
			return 'implementation.md';
		default:
			return null;
	}
}

type LabelKey = 'planning' | 'planned' | 'implementing' | 'reviewing' | 'reviewed' | 'autopilot';

function getCurrentLabelKey(phase: PhaseName): LabelKey | null {
	switch (phase) {
		case 'planning':
			return 'planning';
		case 'plan-review':
			return null;
		case 'implementation':
			return 'implementing';
		case 'review':
			return 'reviewing';
		default:
			return null;
	}
}

function getNextLabelKey(phase: PhaseName): LabelKey | null {
	switch (phase) {
		case 'planning':
			return 'planned';
		case 'plan-review':
			return null;
		case 'implementation':
			return 'reviewing';
		case 'review':
			return 'reviewed';
		default:
			return null;
	}
}

export const __testing = { getCurrentLabelKey, getNextLabelKey };
