import pc from 'picocolors';
import { LocalTrackerAdapter } from '~/adapters/tracker/local.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { loadConfig } from '~/config/loader.ts';
import { __testing as fastTesting } from './fast.ts';

const { generateKey } = fastTesting;

/**
 * `bode new "<summary>"` — creates a local task without running the AI.
 *
 * Use when you want to capture a task on disk first and run it later
 * (e.g. for a separate `bode <key>` invocation, or just to keep a record).
 *
 * For run-now-as-well, use `bode "<summary>"` instead.
 */
export async function newAction(summary: string, options: { project?: string }): Promise<void> {
	const trimmed = summary.trim();
	if (!trimmed) {
		console.error(pc.red('Usage: bode new "<task summary>"'));
		process.exit(1);
	}

	const configResult = await loadConfig();
	if (!configResult.ok) {
		console.error(pc.red(`Configuration error: ${configResult.error.message}`));
		process.exit(1);
	}
	const projectResult = await resolveProject(configResult.value, {
		projectName: options.project,
	});
	if (!projectResult.ok) {
		console.error(pc.red(projectResult.error.message));
		process.exit(1);
	}

	const { projectConfig } = projectResult.value;
	const key = generateKey(trimmed);
	const tracker = new LocalTrackerAdapter(projectConfig.workdir);

	const created = await tracker.createTask(key, trimmed, {
		description: `# ${trimmed}\n\n_Created by bode new at ${new Date().toISOString()}._\n`,
		type: 'Task',
	});

	if (!created.ok) {
		console.error(pc.red(`Could not create local task: ${created.error.message}`));
		process.exit(1);
	}

	console.log(pc.green(`✓ Created task ${pc.bold(key)}`));
	console.log(pc.dim(`  File: ${projectConfig.workdir}/.bode/tasks/${key}.md`));
	console.log('');
	console.log(pc.dim(`To run it now: ${pc.bold(`bode ${key}`)}`));
}
