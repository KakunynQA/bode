import { loadConfig, resolveVcsProvider } from '~/config/loader.ts';
import { loadRunMeta, createRun, saveRunMeta } from '~/storage/run-meta.ts';
import { createJiraAdapter } from '~/adapters/jira/factory.ts';
import { advancePhase } from '~/orchestrator/engine.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { mergePR } from '~/orchestrator/branch-manager.ts';
import { abortRun } from './abort.ts';
import { handlePromptError } from '~/utils/prompt.ts';
import { planDangerousMode } from '~/cli/dangerous-check.ts';
import { handleMissingArtifact } from '~/cli/missing-artifact.ts';
import { printTaskSummary } from '~/cli/summary.ts';
import { select } from '@inquirer/prompts';
import pc from 'picocolors';
import ora from 'ora';

export async function startAction(
	taskKey: string,
	options: {
		project?: string;
		fromBranch?: string;
		auto?: boolean;
		dangerouslyAutoMerge?: boolean;
		dangerouslyApproveAll?: boolean;
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

	let dangerousBypass = false;
	if (options.dangerouslyApproveAll) {
		const plan = await planDangerousMode(config);
		if (!plan.approved) {
			console.log(pc.dim('Aborted by user.'));
			process.exit(0);
		}
		dangerousBypass = true;
	}

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

	const baseBranch = options.fromBranch ?? projectConfig.default_branch ?? 'main';

	// v0.18.0: bode no longer creates branches or checks workdir cleanliness.
	// The AI handles both during the implementation phase (#35). Save run meta
	// with branch: undefined — it gets populated when the AI writes branch.txt
	// during the implementation phase handoff.
	if (!isContinuing) {
		await createRun(taskKey, issue.summary, {
			baseBranch,
			projectName: projectConfig.name,
			workdir: projectConfig.workdir,
		});
		console.log(
			pc.dim(
				`Base branch: ${baseBranch} (the AI will create the working branch during implementation)`
			)
		);
	}

	const isAuto = options.auto ?? false;
	const isDangerous = options.dangerouslyAutoMerge ?? false;
	const interactive = !isAuto && !isDangerous;

	// Warn loudly when --auto runs without --dangerously-approve-all (issue #29).
	// In that combination, the AI is invoked in headless --print mode which is
	// text-only — no file edits, no shell commands. The phases run but no code
	// actually changes. Users hit this and don't realize why nothing happened.
	if ((isAuto || isDangerous) && !dangerousBypass) {
		try {
			const { select } = await import('@inquirer/prompts');
			console.log('');
			console.log(
				pc.yellow('⚠ --auto / --dangerously-auto-merge runs the AI in HEADLESS text-only mode.')
			);
			console.log(
				pc.yellow(
					'  In this mode the AI cannot edit files or run shell commands. The phases will produce'
				)
			);
			console.log(
				pc.yellow(
					'  markdown artifacts under ~/.bode/runs/, but no code in your repo will be changed.'
				)
			);
			console.log('');
			console.log(
				pc.dim(
					'  To make the AI actually implement code, add --dangerously-approve-all (passes the'
				)
			);
			console.log(pc.dim('  CLI bypass-approvals flag).'));
			console.log('');
			const choice = await select({
				message: 'Proceed in text-only mode?',
				choices: [
					{ name: 'Yes — I want the markdown artifacts only', value: 'yes' },
					{ name: 'No — abort so I can re-run with --dangerously-approve-all', value: 'no' },
				],
			});
			if (choice !== 'yes') {
				console.log(pc.dim('Aborted by user.'));
				process.exit(0);
			}
		} catch (err) {
			handlePromptError(err);
			process.exit(1);
		}
	}

	const engineOpts = {
		projectRoot: projectConfig.workdir,
		signal: undefined as AbortSignal | undefined,
		autopilot: undefined as boolean | undefined,
		projectConfig,
		interactive,
		dangerousBypass,
	};

	if (interactive) {
		const result = await advancePhase(taskKey, config, jira, engineOpts);
		if (!result.ok) {
			console.error(pc.red(`Planning failed: ${result.error.message}`));
			process.exit(1);
		}

		const advanceVal = result.value;
		if (advanceVal.kind === 'phase' && advanceVal.phaseResult.kind === 'success') {
			console.log(pc.green(`\nPlan ready. Run ${pc.bold(`bode continue ${taskKey}`)} to advance.`));
		} else if (advanceVal.kind === 'phase' && advanceVal.phaseResult.kind === 'missing-artifact') {
			const decision = await handleMissingArtifact('planning', taskKey);
			if (decision === 'abort') process.exit(1);
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
			pc.yellow('\n⚠ --dangerously-auto-merge: This will run all phases AND auto-merge the PR.')
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
					console.log(
						pc.dim(
							`Switch back to ${advanceVal.meta.baseBranch} manually: \`git checkout ${advanceVal.meta.baseBranch}\``
						)
					);
				}

				const { resolveJiraTransition } = await import('~/config/transitions.ts');
				const doneTarget = resolveJiraTransition('done', config, projectConfig);
				await jira.transitionStatus(taskKey, doneTarget).catch(() => {});

				const finalMeta = { ...advanceVal.meta, status: 'done' as const, updatedAt: Date.now() };
				await saveRunMeta(finalMeta);
				console.log(pc.yellow('\n⚠ Automated review was used — verify before deploying.'));
				printTaskSummary(finalMeta);
			} else {
				console.log(pc.dim('Review the PR manually. Run "bode done" when ready.'));
				printTaskSummary(advanceVal.meta);
			}
			return;
		}

		if (advanceVal.kind === 'phase' && advanceVal.phaseResult.kind === 'missing-artifact') {
			const decision = await handleMissingArtifact('phase', taskKey);
			if (decision === 'abort') process.exit(1);
			if (decision === 'retry') {
				loopCount--; // re-run same phase
				continue;
			}
		}

		if (
			advanceVal.kind === 'phase' &&
			advanceVal.phaseResult.kind !== 'success' &&
			advanceVal.phaseResult.kind !== 'missing-artifact'
		) {
			console.error(
				pc.red(
					`\nPhase ${loopCount} failed: ${advanceVal.phaseResult.kind === 'failed' ? advanceVal.phaseResult.reason : 'timed out'}`
				)
			);
			process.exit(1);
		}

		console.log(pc.dim(`  Phase ${loopCount} done, advancing...\n`));
	}

	console.error(pc.red(`Exceeded max phase iterations (${maxLoops}). Stopping.`));
	process.exit(1);
}
