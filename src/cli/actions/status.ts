import { loadRunMeta } from '~/storage/run-meta.ts';
import { getPhaseStatusLabel } from '~/types/phase.ts';
import pc from 'picocolors';

export async function statusAction(taskKey: string): Promise<void> {
	const result = await loadRunMeta(taskKey);
	if (!result.ok) {
		console.error(pc.red(`Error: ${result.error.message}`));
		process.exit(1);
	}

	if (!result.value) {
		console.error(pc.yellow(`No run found for ${taskKey}`));
		process.exit(1);
	}

	const meta = result.value;
	console.log(`Task: ${pc.bold(meta.taskKey)} - ${meta.jiraSummary}`);
	console.log(`Status: ${pc.cyan(getPhaseStatusLabel(meta.status))}`);
	if (meta.branch) {
		console.log(`Branch: ${pc.dim(meta.branch)} (from ${meta.baseBranch ?? 'unknown'})`);
	}
	if (meta.prUrl) {
		console.log(`PR: ${pc.cyan(meta.prUrl)}`);
	}
	if (meta.conflict) {
		console.log(`Conflict: ${pc.red('YES')}`);
	}
	if (meta.projectName) {
		console.log(`Project: ${pc.dim(meta.projectName)}`);
	}
	console.log(`Started: ${new Date(meta.startedAt).toLocaleString()}`);
	console.log(`Updated: ${new Date(meta.updatedAt).toLocaleString()}`);
	if (meta.error) {
		console.log(`Error: ${pc.red(meta.error)}`);
	}
}
