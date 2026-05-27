import { loadRunMeta, saveRunMeta, type RunMeta } from '~/storage/run-meta.ts';
import { getRunDir } from '~/config/defaults.ts';
import { switchToBase, mergePR } from '~/orchestrator/branch-manager.ts';
import { loadConfig, resolveVcsProvider } from '~/config/loader.ts';
import { createJiraAdapter } from '~/adapters/jira/factory.ts';
import type { BodeConfig } from '~/config/schema.ts';
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

	if (meta.status !== 'awaiting-merge') {
		await finalize(taskKey, meta, config);
		return;
	}

	if (!meta.baseBranch || !meta.branch) {
		await finalize(taskKey, meta, config);
		return;
	}

	let provider: 'github' | 'gitlab' = 'github';
	if (meta.projectName && config) {
		const { loadProjectConfig } = await import('~/config/projects.ts');
		const projResult = await loadProjectConfig(meta.projectName);
		if (projResult.ok && projResult.value) {
			provider = resolveVcsProvider(config, projResult.value);
		}
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

	await finalize(taskKey, meta, config);
}

async function finalize(taskKey: string, meta: RunMeta, config: BodeConfig | null): Promise<void> {
	if (config) {
		await removeBodeLabels(taskKey, config);
		const jira = createJiraAdapter(config.jira);
		await jira.transitionStatus(taskKey, 'Done').catch(() => {});
		const useEmoji = config.comment_format?.use_emoji ?? true;
		const prefix = useEmoji ? '🤖 ' : '';
		await jira
			.addComment(taskKey, `**${prefix}[Bode]** Task complete. Artifacts archived locally.`)
			.catch(() => {});
	}

	await saveRunMeta({ ...meta, status: 'done' });
	console.log(pc.green(`Task ${taskKey} marked as done.`));
	console.log(pc.dim(`Run data at ${getRunDir(taskKey)}`));
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
