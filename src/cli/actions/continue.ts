import { loadConfig } from '~/config/loader.ts';
import { createJiraAdapter } from '~/adapters/jira/factory.ts';
import { advancePhase } from '~/orchestrator/engine.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { planDangerousMode } from '~/cli/dangerous-check.ts';
import { handleMissingArtifact } from '~/cli/missing-artifact.ts';
import pc from 'picocolors';

export async function continueAction(
	taskKey: string,
	options: { project?: string; dangerouslyApproveAll?: boolean }
): Promise<void> {
	const configResult = await loadConfig();
	if (!configResult.ok) {
		console.error(pc.red(`Configuration error: ${configResult.error.message}`));
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

	const result = await advancePhase(taskKey, config, jira, {
		projectRoot: projectConfig.workdir,
		signal: undefined,
		autopilot: undefined,
		projectConfig,
		interactive: true,
		dangerousBypass,
	});
	if (!result.ok) {
		console.error(pc.red(`Error: ${result.error.message}`));
		process.exit(1);
	}

	const advanceVal = result.value;

	if (advanceVal.kind === 'conflict') {
		console.error(pc.yellow('\nConflicts detected with base branch!'));
		console.error(pc.dim('Resolve conflicts manually, then run "bode continue" again.'));
		console.error(pc.dim(`Jira label "bode:conflict" added to ${taskKey}.`));
		process.exit(1);
	}

	if (advanceVal.kind === 'pr-created') {
		console.log(pc.green(`\nPR created: ${pc.bold(advanceVal.prUrl)}`));
		console.log(pc.dim('Review the PR manually. Run "bode done" when ready to finalize.'));
		return;
	}

	if (advanceVal.kind === 'phase') {
		const { meta, phaseResult } = advanceVal;

		if (phaseResult.kind === 'success') {
			console.log(pc.green(`\nPhase complete. Status: ${meta.status}`));

			if (meta.status === 'reviewed') {
				console.log(pc.dim('Run "bode continue" to create PR and move to awaiting-merge.'));
			} else {
				console.log(pc.dim(`Run "bode continue ${taskKey}" to advance.`));
			}
		} else if (phaseResult.kind === 'missing-artifact') {
			const decision = await handleMissingArtifact('phase', taskKey);
			if (decision === 'abort') process.exit(1);
		} else {
			console.error(
				pc.red(
					`\nPhase failed: ${phaseResult.kind === 'failed' ? phaseResult.reason : 'timed out'}`
				)
			);
			process.exit(1);
		}
	}
}
