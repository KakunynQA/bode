import pc from 'picocolors';
import { LocalTrackerAdapter } from '~/adapters/tracker/local.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { loadConfig } from '~/config/loader.ts';
import { startAction } from './start.ts';

const TICKET_KEY_RE = /^[A-Z][A-Z0-9_]*-\d+$/;

/**
 * `bode <query>` — the v0.22.0 fast-path command.
 *
 * If `query` looks like a ticket key (e.g. `KD-312`, `GRD-42`), routes to the
 * regular `start` flow assuming the configured tracker (Jira or Local) knows
 * about it.
 *
 * Otherwise treats `query` as a freeform prompt:
 *   1. Resolves the project (so we know the workdir).
 *   2. Generates a slug-based key (`auto-YYYYMMDD-HHMMSS-<slug>`).
 *   3. Creates a LocalTrackerAdapter task with the prompt as summary + body.
 *   4. Hands off to `startAction` with the new key — the AI sees the task in
 *      the local tracker just like it would see a Jira ticket.
 *
 * For users with no Jira / Linear / GitHub Issues integration, this is the
 * "just give it a sentence and let it work" entry point.
 */
export async function fastAction(
	query: string,
	options: {
		project?: string;
		auto?: boolean;
		dangerouslyAutoMerge?: boolean;
		dangerouslyApproveAll?: boolean;
	}
): Promise<void> {
	const trimmed = query.trim();
	if (!trimmed) {
		console.error(pc.red('No query provided.'));
		console.error(pc.dim('Usage:'));
		console.error(pc.dim('  bode KD-312                       (run a ticket)'));
		console.error(pc.dim('  bode "fix the dashboard bug"      (freeform task)'));
		process.exit(1);
	}

	if (TICKET_KEY_RE.test(trimmed)) {
		await startAction(trimmed, options);
		return;
	}

	const configResult = await loadConfig();
	if (!configResult.ok) {
		console.error(pc.red(`Configuration error: ${configResult.error.message}`));
		process.exit(1);
	}
	const projectResult = await resolveProject(configResult.value, { projectName: options.project });
	if (!projectResult.ok) {
		console.error(pc.red(projectResult.error.message));
		process.exit(1);
	}

	const { projectConfig } = projectResult.value;
	const key = generateKey(trimmed);
	const tracker = new LocalTrackerAdapter(projectConfig.workdir);

	console.log(
		pc.dim(`Creating local task ${pc.bold(key)} at ${projectConfig.workdir}/.bode/tasks/${key}.md`)
	);

	const created = await tracker.createTask(key, trimmed, {
		description: `# ${trimmed}\n\n_Created by bode <prompt> at ${new Date().toISOString()}._\n`,
		type: 'Task',
	});

	if (!created.ok) {
		console.error(pc.red(`Could not create local task: ${created.error.message}`));
		process.exit(1);
	}

	await startAction(key, options);
}

function generateKey(prompt: string): string {
	const now = new Date();
	const stamp =
		now.getUTCFullYear().toString() +
		String(now.getUTCMonth() + 1).padStart(2, '0') +
		String(now.getUTCDate()).padStart(2, '0') +
		'-' +
		String(now.getUTCHours()).padStart(2, '0') +
		String(now.getUTCMinutes()).padStart(2, '0');
	const slug = prompt
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
	return `auto-${stamp}-${slug || 'task'}`;
}

export const __testing = { generateKey, TICKET_KEY_RE };
