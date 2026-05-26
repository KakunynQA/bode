import { loadConfig } from '~/config/loader.ts';
import { loadRunMeta, createRun } from '~/storage/run-meta.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';
import { advancePhase } from '~/orchestrator/engine.ts';
import pc from 'picocolors';
import ora from 'ora';

export async function startAction(taskKey: string, options: { project?: string }): Promise<void> {
  const configResult = await loadConfig(options.project);
  if (!configResult.ok) {
    console.error(pc.red(`Configuration error: ${configResult.error.message}`));
    console.error(pc.dim('Run "bode setup" to configure.'));
    process.exit(1);
  }

  const config = configResult.value;
  const jira = new MockJiraAdapter();

  const spinner = ora(`Fetching ${taskKey}...`).start();

  const issueResult = await jira.getIssue(taskKey);
  if (!issueResult.ok) {
    spinner.fail(`Jira error: ${issueResult.error.message}`);
    process.exit(1);
  }

  const issue = issueResult.value;
  spinner.succeed(`Found: ${issue.summary}`);

  const existing = await loadRunMeta(taskKey);
  if (existing.ok && existing.value) {
    console.error(pc.yellow(`Task ${taskKey} already has a run (status: ${existing.value.status})`));
    console.error(pc.dim('Run "bode abort ' + taskKey + '" to reset, or "bode continue ' + taskKey + '" to advance.'));
    process.exit(1);
  }

  await createRun(taskKey, issue.summary);

  const result = await advancePhase(taskKey, config, jira, { projectRoot: options.project, signal: undefined, autopilot: undefined });
  if (!result.ok) {
    console.error(pc.red(`Planning failed: ${result.error.message}`));
    process.exit(1);
  }

  if (result.value.phaseResult.kind === 'success') {
    console.log(pc.green(`\nPlan ready. Review in Jira and run ${pc.bold(`bode continue ${taskKey}`)}`));
  } else {
    console.error(pc.red(`\nPlanning did not complete: ${result.value.phaseResult.kind === 'failed' ? result.value.phaseResult.reason : 'timed out'}`));
    process.exit(1);
  }
}
