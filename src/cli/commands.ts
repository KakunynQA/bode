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
		.option('--foreground', 'Run in the foreground while still recording scheduler state')
		.option('--no-budget', 'Disable budget enforcement for this run')
		.option(
			'--strict',
			'Enable Wave 6 strict gates (plan review contracts, validation, release gate)'
		)
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
					strict?: boolean;
					foreground?: boolean;
					noBudget?: boolean;
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
		.option('--foreground', 'Run in the foreground while still recording scheduler state')
		.option('--no-budget', 'Disable budget enforcement for this run')
		.option(
			'--strict',
			'Enable Wave 6 strict gates (plan review contracts, validation, release gate)'
		)
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
					strict?: boolean;
					foreground?: boolean;
					noBudget?: boolean;
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
		.option('--html', 'Render artifact to an HTML file and print the path')
		.action(async (artifact: string, taskKey: string, options: { html?: boolean }) => {
			const { showAction } = await import('./actions/show.ts');
			await showAction(artifact, taskKey, options);
		});

	program
		.command('replay <taskKey>')
		.description('Replay a saved run prompt, or export/import a portable .bode-run bundle')
		.option('--phase <name>', 'Phase prompt to replay (default: latest recorded phase)')
		.option('--with-cli <name>', 'Replay with a different CLI adapter')
		.option('--with-model <name>', 'Replay with a different model')
		.option('--export [path]', 'Export run artifacts to a .bode-run JSON bundle')
		.option('--import <path>', 'Import a .bode-run JSON bundle into this task key')
		.action(
			async (
				taskKey: string,
				options: {
					phase?: string;
					withCli?: string;
					withModel?: string;
					export?: string | boolean;
					import?: string;
				}
			) => {
				const { replayAction } = await import('./actions/replay.ts');
				await replayAction(taskKey, options);
			}
		);

	program
		.command('init')
		.description('Scaffold AGENTS.md for the current repo using the configured AI CLI')
		.option('--overwrite', 'Overwrite existing AGENTS.md after showing a diff')
		.option('--from <file>', 'Include an existing rules file as input')
		.action(async (options: { overwrite?: boolean; from?: string }) => {
			const { initAction } = await import('./actions/init.ts');
			await initAction(options);
		});

	program
		.command('learn')
		.description('Generate .bode/context.md for future AI phases')
		.option('--refresh', 'Regenerate even when context.md already exists')
		.option('--detailed', 'Ask for a larger project-context pass')
		.action(async (options: { refresh?: boolean; detailed?: boolean }) => {
			const { learnAction } = await import('./actions/learn.ts');
			await learnAction(options);
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
		.option('--watch', 'Watch scheduler state until interrupted')
		.action(async (options: { watch?: boolean }) => {
			const { listAction } = await import('./actions/list.ts');
			await listAction(options);
		});

	program
		.command('cancel <taskKey>')
		.description('Cancel a scheduled task and remove its scheduler entry')
		.action(async (taskKey: string) => {
			const { cancelAction } = await import('./actions/cancel.ts');
			await cancelAction(taskKey);
		});

	program
		.command('skills [subcommand] [args...]')
		.description('Show resolved skill paths or manage installed community skills')
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.action(
			async (subcommand: string | undefined, args: string[], options: { project?: string }) => {
				const { skillsAction } = await import('./actions/skills.ts');
				await skillsAction({ ...options, ...(subcommand ? { subcommand } : {}), args: args ?? [] });
			}
		);

	program
		.command('doctor')
		.description('Diagnose bode environment, config, AI CLIs, and VCS tooling')
		.option('--report [path]', 'Write a redacted support report without sending it anywhere')
		.action(async (options: { report?: string | boolean }) => {
			const { doctorAction } = await import('./actions/doctor.ts');
			await doctorAction(options);
		});

	program
		.command('feedback')
		.description('Open or print a pre-filled GitHub feedback issue URL (never auto-submits)')
		.option('--title <title>', 'Prefill the issue title')
		.option('--open', 'Open the URL in the default browser')
		.action(async (options: { title?: string; open?: boolean }) => {
			const { feedbackAction } = await import('./actions/feedback.ts');
			await feedbackAction(options);
		});

	program
		.command('telemetry [subcommand]')
		.description('Opt-in telemetry: bode telemetry [on|off|status|preview]')
		.action(async (subcommand: string | undefined) => {
			const { telemetryAction } = await import('./actions/telemetry.ts');
			await telemetryAction(subcommand);
		});

	program
		.command('compare <taskKey>')
		.description('Run planning phase across multiple agents (headless) and compare outputs')
		.requiredOption('--agents <list>', 'Comma-separated agents (e.g. claude-code,codex)')
		.option('--phases <list>', 'Comma-separated phases or "all"')
		.option('--show', 'Show the latest comparison summary for this key')
		.option('--diff <agent>', 'Print the artifact path for one agent')
		.option('--pick <agent>', 'Record the selected agent in the comparison summary')
		.option('--pr-each', 'Plan draft PR creation for each agent (recorded in summary)')
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.action(
			async (
				taskKey: string,
				options: {
					agents: string;
					project?: string;
					phases?: string;
					show?: boolean;
					diff?: string;
					pick?: string;
					prEach?: boolean;
				}
			) => {
				const { compareAction } = await import('./actions/compare.ts');
				await compareAction(taskKey, options);
			}
		);

	program
		.command('setup-transitions')
		.description('Interactively map bode phases to your tracker workflow states')
		.option('--project <name>', 'Project name from ~/.bode/projects/')
		.action(async (options: { project?: string }) => {
			const { setupTransitionsAction } = await import('./actions/setup-transitions.ts');
			await setupTransitionsAction(options);
		});
}
