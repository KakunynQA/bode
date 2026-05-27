import { loadRunMeta, saveRunMeta, type RunMeta } from '~/storage/run-meta.ts';
import { switchToBase, mergePR } from '~/orchestrator/branch-manager.ts';
import { loadConfig, resolveVcsProvider } from '~/config/loader.ts';
import { createJiraAdapter } from '~/adapters/jira/factory.ts';
import { resolveJiraTransition } from '~/config/transitions.ts';
import { loadProjectConfig } from '~/config/projects.ts';
import { printTaskSummary } from '~/cli/summary.ts';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import pc from 'picocolors';

export async function doneAction(
	taskKey: string,
	options: { yes?: boolean; autoApprovePrMerge?: boolean }
): Promise<void> {
	if (!options.yes) {
		console.log(pc.yellow(`Mark ${taskKey} as done? Use --yes to confirm.`));
		return;
	}

	const result = await loadRunMeta(taskKey);
	if (!result.ok || !result.value) {
		console.error(pc.red(`No run found for ${taskKey}`));
		process.exit(1);
	}

	const meta = result.value;
	const configResult = await loadConfig();
	const config = configResult.ok ? configResult.value : null;

	let projectCfg: ProjectConfig | undefined;
	if (meta.projectName) {
		const projResult = await loadProjectConfig(meta.projectName);
		if (projResult.ok && projResult.value) {
			projectCfg = projResult.value;
		}
	}

	if (meta.status !== 'awaiting-merge') {
		await finalize(taskKey, meta, config, projectCfg);
		return;
	}

	if (!meta.baseBranch || !meta.branch) {
		await finalize(taskKey, meta, config, projectCfg);
		return;
	}

	let provider: 'github' | 'gitlab' = 'github';
	if (projectCfg && config) {
		provider = resolveVcsProvider(config, projectCfg);
	}

	if (options.autoApprovePrMerge && meta.prNumber) {
		console.log(
			pc.yellow('\nAuto-merge can cause problems. Use only if you trust the automated review.')
		);

		const mergeResult = await mergePR(meta.prNumber, provider);
		if (!mergeResult.ok) {
			console.error(pc.red(`Auto-merge failed: ${mergeResult.error.message}`));
			console.error(pc.dim('Merge the PR manually: ' + (meta.prUrl ?? '')));
		} else {
			console.log(pc.green(`PR #${meta.prNumber} merged and branch deleted.`));
		}
	} else if (meta.prUrl) {
		console.log(pc.dim(`\nPR pending: ${meta.prUrl} — merge manually when ready.`));
	}

	const workdir = meta.workdir ?? process.cwd();
	const switchResult = await switchToBase(workdir, meta.baseBranch);
	if (!switchResult.ok) {
		console.error(
			pc.yellow(`Could not switch to ${meta.baseBranch}: ${switchResult.error.message}`)
		);
	} else {
		console.log(pc.dim(`Switched to ${meta.baseBranch}`));
	}

	await finalize(taskKey, meta, config, projectCfg);
}

async function finalize(
	taskKey: string,
	meta: RunMeta,
	config: BodeConfig | null,
	projectCfg: ProjectConfig | undefined
): Promise<void> {
	if (config) {
		await removeBodeLabels(taskKey, config);
		const jira = createJiraAdapter(config.jira);
		const doneTarget = resolveJiraTransition('done', config, projectCfg);
		if (doneTarget.trim() !== '') {
			const transResult = await jira.transitionStatus(taskKey, doneTarget);
			if (!transResult.ok) {
				console.warn(pc.yellow(`[bode] Jira transition skipped: ${transResult.error.message}`));
				console.warn(
					pc.dim('  Configure jira.transitions.done in your project YAML to match your workflow.')
				);
			}
		}
		const useEmoji = config.comment_format?.use_emoji ?? true;
		const prefix = useEmoji ? '🤖 ' : '';
		await jira
			.addComment(taskKey, `**${prefix}[Bode]** Task complete. Artifacts archived locally.`)
			.catch(() => {});
	}

	const finalMeta: RunMeta = { ...meta, status: 'done', updatedAt: Date.now() };
	await saveRunMeta(finalMeta);
	printTaskSummary(finalMeta);
}

async function removeBodeLabels(taskKey: string, config: BodeConfig): Promise<void> {
	const labels = config.jira_labels;
	if (!labels) return;
	const jira = createJiraAdapter(config.jira);
	const allLabels = new Set<string>([...Object.values(labels), 'bode:conflict']);
	for (const label of allLabels) {
		await jira.removeLabel(taskKey, label).catch(() => {});
	}
}
