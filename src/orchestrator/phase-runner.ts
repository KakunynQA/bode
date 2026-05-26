import type { BodeConfig } from '~/config/schema.ts';
import type { PhaseName, PhaseStatus } from '~/types/phase.ts';
import { getPhaseNameForStatus, getNextPhase } from '~/types/phase.ts';
import type { JiraAdapter } from '~/types/jira.ts';
import type { CliAdapterConfig } from '~/types/cli-adapter.ts';
import type { Result } from '~/types/result.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { loadSkillPrompt } from '~/skills/resolver.ts';
import { buildPrompt } from '~/skills/prompt-builder.ts';
import { saveRunMeta, loadRunMeta } from '~/storage/run-meta.ts';
import { getRunDir } from '~/config/defaults.ts';
import { writeText, readText } from '~/utils/fs.ts';
import { join } from 'node:path';

export type PhaseRunResult =
  | { kind: 'success'; artifact: string; logPath: string; durationMs: number }
  | { kind: 'failed'; reason: string; logPath: string }
  | { kind: 'timeout'; logPath: string };

export async function runPhase(
  taskKey: string,
  status: PhaseStatus,
  config: BodeConfig,
  jira: JiraAdapter,
  options: { projectRoot: string | undefined; signal: AbortSignal | undefined }
): Promise<Result<PhaseRunResult>> {
  const phaseName = getPhaseNameForStatus(status);
  if (!phaseName) {
    return { ok: false, error: new Error(`No phase name for status: ${status}`) };
  }

  const phaseConfig = config.phases[phaseName];
  if (!phaseConfig) {
    return { ok: false, error: new Error(`No config for phase: ${phaseName}`) };
  }

  const adapterResult = getAdapter(phaseConfig.cli);
  if (!adapterResult.ok) return adapterResult;

  const skillResult = await loadSkillPrompt(phaseName, { projectRoot: options.projectRoot, globalDir: undefined });
  if (!skillResult.ok) return skillResult;

  const issueResult = await jira.getIssue(taskKey, options.signal);
  if (!issueResult.ok) return issueResult;
  const issue = issueResult.value;

  const priorArtifactPath = join(getRunDir(taskKey), `${getPriorPhaseFile(phaseName)}`);
  const priorArtifact = (await readText(priorArtifactPath)) ?? undefined;

  const prompt = buildPrompt(skillResult.value, {
    jiraIssue: issue,
    projectAgentsMd: undefined,
    repoFileTree: undefined,
    priorArtifact,
  });

  const runDir = getRunDir(taskKey);
  const logPath = join(runDir, `${phaseName}.log`);
  const artifactPath = join(runDir, `${phaseName}.md`);

  const cliConfig: CliAdapterConfig = {
    cli: phaseConfig.cli,
    model: phaseConfig.model,
    timeout_minutes: phaseConfig.timeout_minutes,
  };

  const labels = config.jira_labels;
  if (labels) {
    await jira.addLabel(taskKey, labels[phaseName as keyof typeof labels] ?? `bode:${phaseName}`);
  }

  const invokeResult = await adapterResult.value.invoke(prompt, cliConfig, options.signal);

  if (!invokeResult.ok) {
    const failLog = `Phase ${phaseName} failed: ${invokeResult.error.message}`;
    await writeText(logPath, failLog);

    const metaResult = await loadRunMeta(taskKey);
    if (metaResult.ok && metaResult.value) {
      await saveRunMeta({ ...metaResult.value, status: 'failed', error: invokeResult.error.message });
    }

    return {
      ok: true,
      value: { kind: 'failed', reason: invokeResult.error.message, logPath },
    };
  }

  const invocation = invokeResult.value;
  await writeText(logPath, invocation.stdout);
  await writeText(artifactPath, invocation.stdout);

  const labelsConfig = config.jira_labels;
  if (labelsConfig) {
    const phaseLabel = labelsConfig[phaseName as keyof typeof labelsConfig];
    if (phaseLabel) await jira.removeLabel(taskKey, phaseLabel);
    const nextLabelKey = getNextLabelKey(phaseName);
    if (nextLabelKey) {
      const nextLabel = labelsConfig[nextLabelKey as keyof typeof labelsConfig];
      if (nextLabel) await jira.addLabel(taskKey, nextLabel);
    }
  }

  const nextStatus = getNextPhase(status);
  if (nextStatus) {
    const metaResult = await loadRunMeta(taskKey);
    if (metaResult.ok && metaResult.value) {
      await saveRunMeta({ ...metaResult.value, status: nextStatus });
    }
  }

  return {
    ok: true,
    value: {
      kind: 'success',
      artifact: invocation.stdout,
      logPath,
      durationMs: invocation.durationMs,
    },
  };
}

function getPriorPhaseFile(phase: PhaseName): string | null {
  switch (phase) {
    case 'planning':
      return '';
    case 'implementation':
      return 'planning.md';
    case 'review':
      return 'implementation.md';
    default:
      return null;
  }
}

function getNextLabelKey(phase: PhaseName): string | null {
  switch (phase) {
    case 'planning':
      return 'planned';
    case 'implementation':
      return 'reviewing';
    case 'review':
      return 'reviewed';
    default:
      return null;
  }
}
