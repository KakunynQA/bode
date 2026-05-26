import { Command } from 'commander';

export function createCommands(program: Command): void {
  program
    .command('setup')
    .description('Configure Jira OAuth, default CLIs per phase, and validate connections')
    .action(async () => {
      const { setupAction } = await import('./actions/setup.ts');
      await setupAction();
    });

  program
    .command('start <taskKey>')
    .description('Start a task. Runs planning phase.')
    .option('-p, --project <path>', 'Project root directory')
    .action(async (taskKey: string, options: { project?: string }) => {
      const { startAction } = await import('./actions/start.ts');
      await startAction(taskKey, options);
    });

  program
    .command('continue <taskKey>')
    .description('Advance to next phase')
    .option('-p, --project <path>', 'Project root directory')
    .action(async (taskKey: string, options: { project?: string }) => {
      const { continueAction } = await import('./actions/continue.ts');
      await continueAction(taskKey, options);
    });

  program
    .command('status <taskKey>')
    .description('Show current phase and Jira link')
    .action(async (taskKey: string) => {
      const { statusAction } = await import('./actions/status.ts');
      await statusAction(taskKey);
    });

  program
    .command('show <artifact> <taskKey>')
    .description('Print artifact to stdout (plan, implementation, review)')
    .action(async (artifact: string, taskKey: string) => {
      const { showAction } = await import('./actions/show.ts');
      await showAction(artifact, taskKey);
    });

  program
    .command('log <taskKey>')
    .description('Show the log of the current or last phase')
    .action(async (taskKey: string) => {
      const { logAction } = await import('./actions/log.ts');
      await logAction(taskKey);
    });

  program
    .command('abort <taskKey>')
    .description('Cancel current execution and reset labels')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (taskKey: string, options: { yes?: boolean }) => {
      const { abortAction } = await import('./actions/abort.ts');
      await abortAction(taskKey, options);
    });

  program
    .command('done <taskKey>')
    .description('Mark task as done. Moves Jira to Done. Cleans labels.')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (taskKey: string, options: { yes?: boolean }) => {
      const { doneAction } = await import('./actions/done.ts');
      await doneAction(taskKey, options);
    });

  program
    .command('list')
    .description('List all tasks currently tracked locally')
    .action(async () => {
      const { listAction } = await import('./actions/list.ts');
      await listAction();
    });

  program
    .command('skills')
    .description('Show resolved skill paths and prompts')
    .option('-p, --project <path>', 'Project root directory')
    .action(async (options: { project?: string }) => {
      const { skillsAction } = await import('./actions/skills.ts');
      await skillsAction(options);
    });
}
