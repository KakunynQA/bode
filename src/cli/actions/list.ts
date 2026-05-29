import { readdir } from 'node:fs/promises';
import { getRunsDir } from '~/config/defaults.ts';
import { loadRunMeta } from '~/storage/run-meta.ts';
import { getPhaseStatusLabel } from '~/types/phase.ts';
import { readScheduler } from '~/orchestrator/scheduler.ts';
import { getTaskCost } from '~/orchestrator/budget-tracker.ts';
import pc from 'picocolors';

export async function listAction(options: { watch?: boolean } = {}): Promise<void> {
	if (options.watch) {
		if (!process.stdout.isTTY) {
			console.log(pc.dim('bode list --watch requires a TTY.'));
			return;
		}
		while (true) {
			console.clear();
			await printScheduler();
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	const runsDir = getRunsDir();

	try {
		const entries = await readdir(runsDir);
		if (entries.length === 0) {
			console.log(pc.dim('No tasks tracked. Run "bode start <KEY>" to begin.'));
			return;
		}

		for (const entry of entries) {
			const result = await loadRunMeta(entry);
			if (result.ok && result.value) {
				const meta = result.value;
				const cost = await getTaskCost(meta.taskKey);
				const branchInfo = meta.branch ? pc.dim(` (${meta.branch})`) : '';
				const conflictInfo = meta.conflict ? pc.red(' [CONFLICT]') : '';
				console.log(
					`${pc.bold(meta.taskKey)} ${pc.dim('-')} ${meta.trackerSummary} ${pc.dim('|')} ${getPhaseStatusLabel(meta.status)} ${pc.dim(`$${cost.toFixed(2)}`)}${branchInfo}${conflictInfo}`
				);
			}
		}
	} catch {
		console.log(pc.dim('No tasks tracked. Run "bode start <KEY>" to begin.'));
	}
}

async function printScheduler(): Promise<void> {
	const state = await readScheduler();
	console.log(pc.bold('Bode scheduler'));
	console.log(pc.dim(`updated ${state.updated_at}`));
	console.log('');
	if (state.tasks.length === 0) {
		console.log(pc.dim('No scheduled tasks.'));
		return;
	}
	for (const task of state.tasks) {
		console.log(
			`${pc.bold(task.key)} ${task.status.padEnd(9)} ${task.phase.padEnd(14)} pid=${task.pid} ${pc.dim(task.repo)}`
		);
	}
}
