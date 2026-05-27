import { Command } from 'commander';

export function createCommands(program: Command): void {
	// Default action: `bode <query>` where query is a ticket key OR a freeform
	// prompt. Routes to startAction for tickets, creates a local task otherwise.
	// Registered FIRST so subcommands take precedence; this only fires when no
	// subcommand matches.
	program
		.argument('[query...]', 'Ticket key (e.g. KD-312) or freeform prompt')
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.option('--auto', 'Run all phases automatically until PR is created')
		.option('--dangerously-auto-merge', 'Run all phases AND auto-merge the PR (use with caution)')
		.option(
			'--dangerously-approve-all',
			'Pass each CLI its bypass-approvals/sandbox flag. Use only on trusted code.'
		)
		.action(
			async (
				query: string[] | undefined,
				options: {
					project?: string;
					auto?: boolean;
					dangerouslyAutoMerge?: boolean;
					dangerouslyApproveAll?: boolean;
				}
			) => {
				const joined = (query ?? []).join(' ').trim();
				if (!joined) {
					program.outputHelp();
					return;
				}
				const { fastAction } = await import('./actions/fast.ts');
				await fastAction(joined, options);
			}
		);

	program
		.command('new <summary...>')
		.description('Create a local task (.bode/tasks/<key>.md) without running the AI yet')
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.action(async (summary: string[], options: { project?: string }) => {
			const { newAction } = await import('./actions/new.ts');
			await newAction(summary.join(' '), options);
		});

	program
		.command('setup')
		.description(
			'Configure Jira OAuth, default CLIs per phase, VCS provider, and validate connections'
		)
		.action(async () => {
			const { setupAction } = await import('./actions/setup.ts');
			await setupAction();
		});

	program
		.command('setup-project')
		.description('Create or edit a project config (workdir, context, VCS, Jira overrides)')
		.action(async () => {
			const { setupAction } = await import('./actions/setup.ts');
			await setupAction('project');
		});

	program
		.command('start <taskKey>')
		.description('Start a task. Creates branch, runs planning phase. Use --auto to run all phases.')
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.option('--from-branch <branch>', 'Base branch (default: project default_branch or main)')
		.option('--auto', 'Run all phases automatically until PR is created')
		.option('--dangerously-auto-merge', 'Run all phases AND auto-merge the PR (use with caution)')
		.option(
			'--dangerously-approve-all',
			'Pass each CLI its bypass-approvals/sandbox flag. Use only on trusted code.'
		)
		.action(
			async (
				taskKey: string,
				options: {
					project?: string;
					fromBranch?: string;
					auto?: boolean;
					dangerouslyAutoMerge?: boolean;
					dangerouslyApproveAll?: boolean;
				}
			) => {
				const { startAction } = await import('./actions/start.ts');
				await startAction(taskKey, options);
			}
		);

	program
		.command('continue <taskKey>')
		.description('Advance to next phase')
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.option(
			'--dangerously-approve-all',
			'Pass each CLI its bypass-approvals/sandbox flag. Use only on trusted code.'
		)
		.action(
			async (taskKey: string, options: { project?: string; dangerouslyApproveAll?: boolean }) => {
				const { continueAction } = await import('./actions/continue.ts');
				await continueAction(taskKey, options);
			}
		);

	program
		.command('status <taskKey>')
		.description('Show current phase, branch, PR link, and Jira status')
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
		.description('Cancel current execution, clean up branch, and reset labels')
		.option('-y, --yes', 'Skip confirmation')
		.action(async (taskKey: string, options: { yes?: boolean }) => {
			const { abortAction } = await import('./actions/abort.ts');
			await abortAction(taskKey, options);
		});

	program
		.command('done <taskKey>')
		.description('Mark task as done. Switches to base branch. Optionally merges PR.')
		.option('-y, --yes', 'Skip confirmation')
		.option('--auto-approve-pr-merge', 'Automatically merge PR (use with caution)')
		.action(async (taskKey: string, options: { yes?: boolean; autoApprovePrMerge?: boolean }) => {
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
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.action(async (options: { project?: string }) => {
			const { skillsAction } = await import('./actions/skills.ts');
			await skillsAction(options);
		});

	program
		.command('doctor')
		.description('Diagnose bode environment, config, AI CLIs, and VCS tooling')
		.action(async () => {
			const { doctorAction } = await import('./actions/doctor.ts');
			await doctorAction();
		});

	program
		.command('telemetry [subcommand]')
		.description('Opt-in telemetry: bode telemetry [on|off|status|preview]')
		.action(async (subcommand: string | undefined) => {
			const { telemetryAction } = await import('./actions/telemetry.ts');
			await telemetryAction(subcommand);
		});
}
