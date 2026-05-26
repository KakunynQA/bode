import { loadConfig } from '~/config/loader.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';
import { advancePhase } from '~/orchestrator/engine.ts';
import pc from 'picocolors';

export async function continueAction(taskKey: string, options: { project?: string }): Promise<void> {
  const configResult = await loadConfig(options.project);
  if (!configResult.ok) {
    console.error(pc.red(`Configuration error: ${configResult.error.message}`));
    process.exit(1);
  }

  const jira = new MockJiraAdapter();

  const result = await advancePhase(taskKey, configResult.value, jira, { projectRoot: options.project, signal: undefined, autopilot: undefined });
  if (!result.ok) {
    console.error(pc.red(`Error: ${result.error.message}`));
    process.exit(1);
  }

  const { meta, phaseResult } = result.value;

  if (phaseResult.kind === 'success') {
    console.log(pc.green(`\nPhase complete. Status: ${meta.status}`));

    if (meta.status === 'reviewed') {
      console.log(pc.dim('Self-review complete. Human review needed.'));
    } else {
      console.log(pc.dim(`Run "bode continue ${taskKey}" to advance.`));
    }
  } else {
    console.error(pc.red(`\nPhase failed: ${phaseResult.kind === 'failed' ? phaseResult.reason : 'timed out'}`));
    process.exit(1);
  }
}
