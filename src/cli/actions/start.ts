import { loadConfig, resolveVcsProvider } from '~/config/loader.ts';
import { loadRunMeta, createRun, saveRunMeta } from '~/storage/run-meta.ts';
import { createJiraAdapter } from '~/adapters/jira/factory.ts';
import { advancePhase } from '~/orchestrator/engine.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { startBranch, mergePR, switchToBase } from '~/orchestrator/branch-manager.ts';
import { isClean, stash } from '~/adapters/vcs/git.ts';
import { abortRun } from './abort.ts';
import { handlePromptError } from '~/utils/prompt.ts';
import { printPermissionWarning } from '~/utils/permission-warning.ts';
import { select } from '@inquirer/prompts';
import pc from 'picocolors';
import ora from 'ora';

export async function startAction(
	taskKey: string,
	options: {
		project?: string;
		fromBranch?: string;
		auto?: boolean;
		autoAndMergeDangerously?: boolean;
	}
): Promise<void> {
	const configResult = await loadConfig();
	if (!configResult.ok) {
		console.error(pc.red(`Configuration error: ${configResult.error.message}`));
		console.error(pc.dim('Run "bode setup" to configure.'));
		process.exit(1);
	}

	const baseConfig = configResult.value;

	const projectResult = await resolveProject(baseConfig, { projectName: options.project });
	if (!projectResult.ok) {
		console.error(pc.red(projectResult.error.message));
		process.exit(1);
	}

	const { config, projectConfig } = projectResult.value;
	const jira = createJiraAdapter(config.jira);

	const spinner = ora(`Fetching ${taskKey}...`).start();

	const issueResult = await jira.getIssue(taskKey);
	if (!issueResult.ok) {
		spinner.fail(`Jira error: ${issueResult.error.message}`);
		process.exit(1);
	}

	const issue = issueResult.value;
	spinner.succeed(`Found: ${issue.summary} [${issue.issueType}]`);

	const transitionsResult = await jira.getTransitions(taskKey);
	if (!transitionsResult.ok) {
		console.log(pc.yellow(`⚠ Cannot check Jira transitions: ${transitionsResult.error.message}`));
		console.log(
			pc.dim('  Jira card moves and comments will not work. Run "bode setup" to configure Jira.')
		);
	} else if (transitionsResult.value.length === 0) {
		console.log(pc.yellow('⚠ No available Jira transitions for this issue.'));
		console.log(
			pc.dim(
				'  Card may not move automatically. Check that transitions are configured in your workflow.'
			)
		);
	} else {
		const names = transitionsResult.value.map((t) => {
			const label = t.toStatusName ?? t.name;
			return t.name !== label ? `${t.name} → ${label}` : t.name;
		});
		console.log(pc.dim(`  Jira: available — ${names.join(', ')}`));
	}

	let isContinuing = false;

	const existing = await loadRunMeta(taskKey);
	if (existing.ok && existing.value) {
		console.log(pc.yellow(`Task ${taskKey} already has a run (status: ${existing.value.status})`));

		try {
			const action = await select({
				message: 'What to do?',
				choices: [
					{
						name: 'Abort and restart',
						value: 'restart',
						description: 'Abort current run and start fresh',
					},
					{
						name: 'Continue',
						value: 'continue',
						description: 'Skip branch setup and continue from current phase',
					},
					{ name: 'Cancel', value: 'cancel' },
				],
			});

			if (action === 'cancel') process.exit(0);
			if (action === 'restart') {
				const abortResult = await abortRun(taskKey);
				if (!abortResult.ok) {
					console.error(pc.red(`Abort failed: ${abortResult.error.message}`));
					process.exit(1);
				}
				console.log(pc.green('Previous run aborted. Starting fresh...'));
			}
			if (action === 'continue') {
				isContinuing = true;
			}
		} catch (err) {
			handlePromptError(err);
			process.exit(1);
		}
	}

	if (!isContinuing) {
		const cleanResult = await isClean(projectConfig.workdir);
		if (cleanResult.ok && !cleanResult.value) {
			console.log(pc.yellow('Working directory has uncommitted changes.'));

			try {
				const action = await select({
					message: 'What to do?',
					choices: [
						{ name: 'Stash changes and continue', value: 'stash' },
						{ name: 'Retry (I will handle it manually)', value: 'retry' },
						{ name: 'Abort', value: 'abort' },
					],
				});

				if (action === 'abort') process.exit(0);
				if (action === 'retry') {
					console.log(pc.dim('Clean up manually and run the command again.'));
					process.exit(0);
				}
				if (action === 'stash') {
					const stashResult = await stash(projectConfig.workdir, `bode:auto-stash:${taskKey}`);
					if (!stashResult.ok) {
						console.error(pc.red(`Stash failed: ${stashResult.error.message}`));
						process.exit(1);
					}
					console.log(pc.green('Changes stashed. Proceeding...'));
				}
			} catch (err) {
				handlePromptError(err);
				process.exit(1);
			}
		}
	}

	const baseBranch = options.fromBranch ?? projectConfig.default_branch ?? 'main';

	if (!isContinuing) {
		console.log(pc.dim(`Creating branch from ${baseBranch}...`));

		const branchResult = await startBranch(
			projectConfig.workdir,
			taskKey,
			issue.issueType,
			baseBranch
		);
		if (!branchResult.ok) {
			console.error(pc.red(`Branch error: ${branchResult.error.message}`));
			process.exit(1);
		}

		const branch = branchResult.value;
		console.log(pc.green(`Branch created: ${branch} (from ${baseBranch})`));

		await createRun(taskKey, issue.summary, {
			branch,
			baseBranch,
			projectName: projectConfig.name,
			workdir: projectConfig.workdir,
		});
	}

	const engineOpts = {
		projectRoot: projectConfig.workdir,
		signal: undefined as AbortSignal | undefined,
		autopilot: undefined as boolean | undefined,
		projectConfig,
	};

	const isAuto = options.auto ?? false;
	const isDangerous = options.autoAndMergeDangerously ?? false;

	if (!isAuto && !isDangerous) {
		const result = await advancePhase(taskKey, config, jira, engineOpts);
		if (!result.ok) {
			console.error(pc.red(`Planning failed: ${result.error.message}`));
			process.exit(1);
		}

		const advanceVal = result.value;
		if (advanceVal.kind === 'phase' && advanceVal.phaseResult.kind === 'success') {
			if (advanceVal.phaseResult.permissionIssue) {
				printPermissionWarning(advanceVal.phaseResult.permissionIssue);
			}
			console.log(pc.green(`\nPlan ready. Run ${pc.bold(`bode continue ${taskKey}`)} to advance.`));
		} else if (advanceVal.kind === 'phase') {
			console.error(
				pc.red(
					`\nPlanning failed: ${advanceVal.phaseResult.kind === 'failed' ? advanceVal.phaseResult.reason : 'timed out'}`
				)
			);
			process.exit(1);
		}
		return;
	}

	if (isDangerous) {
		console.log(
			pc.yellow('\n⚠ --auto-and-merge-dangerously: This will run all phases AND auto-merge the PR.')
		);
		console.log(pc.yellow('  Automated review may miss issues. Verify before deploying.\n'));
	}

	console.log(pc.cyan('Auto mode: running all phases...\n'));

	let loopCount = 0;
	const maxLoops = 10;

	while (loopCount < maxLoops) {
		loopCount++;

		const result = await advancePhase(taskKey, config, jira, engineOpts);
		if (!result.ok) {
			console.error(pc.red(`Error in phase ${loopCount}: ${result.error.message}`));
			process.exit(1);
		}

		const advanceVal = result.value;

		if (advanceVal.kind === 'conflict') {
			console.error(pc.yellow('\nConflicts detected! Stopping auto mode.'));
			console.error(pc.dim('Resolve conflicts manually, then run "bode continue".'));
			process.exit(1);
		}

		if (advanceVal.kind === 'pr-created') {
			console.log(pc.green(`\nPR created: ${pc.bold(advanceVal.prUrl)}`));

			if (isDangerous && advanceVal.meta.prNumber) {
				console.log(pc.dim('Auto-merging PR...'));

				const provider = resolveVcsProvider(config, projectConfig);
				const mergeResult = await mergePR(advanceVal.meta.prNumber, provider);
				if (!mergeResult.ok) {
					console.error(pc.red(`Auto-merge failed: ${mergeResult.error.message}`));
					console.error(pc.dim('Merge manually: ' + (advanceVal.meta.prUrl ?? '')));
					process.exit(1);
				}

				console.log(pc.green(`PR #${advanceVal.meta.prNumber} merged and branch deleted.`));

				if (advanceVal.meta.baseBranch) {
					const switchResult = await switchToBase(
						projectConfig.workdir,
						advanceVal.meta.baseBranch
					);
					if (switchResult.ok) {
						console.log(pc.dim(`Switched to ${advanceVal.meta.baseBranch}`));
					}
				}

				await saveRunMeta({ ...advanceVal.meta, status: 'done' });
				await jira.transitionStatus(taskKey, 'Done');

				console.log(pc.green(`\n✓ Task ${taskKey} complete.`));
				console.log(pc.yellow('⚠ Automated review was used — verify before deploying.'));
			} else {
				console.log(pc.dim('Review the PR manually. Run "bode done" when ready.'));
			}
			return;
		}

		if (advanceVal.kind === 'phase' && advanceVal.phaseResult.kind !== 'success') {
			console.error(
				pc.red(
					`\nPhase ${loopCount} failed: ${advanceVal.phaseResult.kind === 'failed' ? advanceVal.phaseResult.reason : 'timed out'}`
				)
			);
			process.exit(1);
		}

		if (
			advanceVal.kind === 'phase' &&
			advanceVal.phaseResult.kind === 'success' &&
			advanceVal.phaseResult.permissionIssue
		) {
			printPermissionWarning(advanceVal.phaseResult.permissionIssue);
			console.error(
				pc.yellow(
					'Auto mode stopping: grant access (or remove the path) and rerun "bode continue".'
				)
			);
			process.exit(1);
		}

		console.log(pc.dim(`  Phase ${loopCount} done, advancing...\n`));
	}

	console.error(pc.red(`Exceeded max phase iterations (${maxLoops}). Stopping.`));
	process.exit(1);
}
