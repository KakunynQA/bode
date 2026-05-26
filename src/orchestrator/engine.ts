import type { BodeConfig } from '~/config/schema.ts';
import type { PhaseStatus } from '~/types/phase.ts';
import { getNextPhase, getPhaseStatusLabel } from '~/types/phase.ts';
import type { JiraAdapter } from '~/types/jira.ts';
import { loadRunMeta, saveRunMeta, type RunMeta } from '~/storage/run-meta.ts';
import { runPhase, type PhaseRunResult } from './phase-runner.ts';
import type { Result } from '~/types/result.ts';
import ora from 'ora';

export async function advancePhase(
  taskKey: string,
  config: BodeConfig,
  jira: JiraAdapter,
  options: { projectRoot: string | undefined; signal: AbortSignal | undefined; autopilot: boolean | undefined }
): Promise<Result<{ meta: RunMeta; phaseResult: PhaseRunResult }>> {
  const metaResult = await loadRunMeta(taskKey);
  if (!metaResult.ok) return metaResult;

  const meta = metaResult.value;
  if (!meta) {
    return { ok: false, error: new Error(`No run found for ${taskKey}. Run 'bode start ${taskKey}' first.`) };
  }

  const nextStatus = getNextPhase(meta.status);
  if (!nextStatus) {
    return { ok: false, error: new Error(`Task ${taskKey} is already at '${meta.status}'. No next phase.`) };
  }

  const executingStatus = getExecutingStatus(nextStatus);
  if (!executingStatus) {
    return { ok: false, error: new Error(`Cannot determine executing status for next phase: ${nextStatus}`) };
  }

  await saveRunMeta({ ...meta, status: executingStatus });

  const spinner = ora(`Running ${getPhaseStatusLabel(executingStatus)} phase...`).start();

  const phaseResult = await runPhase(taskKey, executingStatus, config, jira, {
    projectRoot: options.projectRoot,
    signal: options.signal,
  });

  if (!phaseResult.ok) {
    spinner.fail(`Phase failed: ${phaseResult.error.message}`);
    return phaseResult;
  }

  const result = phaseResult.value;

  if (result.kind === 'success') {
    spinner.succeed(`${getPhaseStatusLabel(nextStatus)} complete (${formatDuration(result.durationMs)})`);
  } else if (result.kind === 'failed') {
    spinner.fail(`Phase failed: ${result.reason}`);
  } else {
    spinner.warn('Phase timed out');
  }

  const updatedMeta = await loadRunMeta(taskKey);
  if (!updatedMeta.ok || !updatedMeta.value) {
    return { ok: false, error: new Error('Failed to load updated run meta') };
  }

  return { ok: true, value: { meta: updatedMeta.value, phaseResult: result } };
}

function getExecutingStatus(nextStatus: PhaseStatus): PhaseStatus | null {
  switch (nextStatus) {
    case 'planned':
      return 'planning';
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
