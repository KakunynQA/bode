import pc from 'picocolors';
import {
	readScheduler,
	removeSchedulerTask,
	updateSchedulerTask,
} from '~/orchestrator/scheduler.ts';

export async function cancelAction(taskKey: string): Promise<void> {
	const state = await readScheduler();
	const task = state.tasks.find((t) => t.key.toUpperCase() === taskKey.toUpperCase());
	if (!task) {
		console.log(pc.yellow(`No scheduled task found for ${taskKey}`));
		return;
	}
	if (task.status === 'running') {
		try {
			process.kill(task.pid, 'SIGTERM');
		} catch {
			// Process may already be gone; scheduler cleanup still applies.
		}
	}
	await updateSchedulerTask(taskKey, { status: 'cancelled' });
	await removeSchedulerTask(taskKey);
	console.log(pc.green(`Cancelled ${taskKey}`));
}
