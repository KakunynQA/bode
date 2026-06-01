import pc from 'picocolors';
import { askSelect, BACK } from '~/utils/prompt.ts';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadConfig } from '~/config/loader.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { selectTracker } from '~/adapters/tracker/factory.ts';
import { handlePromptError } from '~/utils/prompt.ts';
import type { TransitionKey } from '~/config/transitions.ts';

/**
 * Interactive Jira transition mapper (#30).
 *
 * Scans the active tracker for available transitions, then asks the user to
 * map each bode phase event to one of them. Writes the result to the project's
 * `.bode.yml` (or creates one), so future `bode start` / `continue` calls use
 * the right transition names without surprises.
 *
 *   bode setup-transitions
 *
 * Runs against any tracker that exposes `listStatuses` — Jira, Linear, etc.
 * Trackers with no workflow concept (LocalTracker, GitHub Issues) return a
 * fixed list and the picker still works.
 */
export async function setupTransitionsAction(options: { project?: string }): Promise<void> {
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

	const { config, projectConfig } = projectResult.value;
	const tracker = selectTracker({
		jira: config.jira,
		workdir: projectConfig.workdir,
		...(config.linear ? { linear: config.linear } : {}),
		...(config.notion ? { notion: config.notion } : {}),
		...(config.trello ? { trello: config.trello } : {}),
		...(projectConfig.tracker
			? { tracker: projectConfig.tracker }
			: config.tracker
				? { tracker: config.tracker }
				: {}),
	});

	console.log(pc.bold(`Configuring transitions for project "${projectConfig.name}"`));
	console.log(pc.dim(`  Tracker: ${tracker.kind}`));

	// Pick any task to query for available transitions — for trackers that
	// scope statuses to a workflow context (Jira, Linear). For trackers that
	// return a global list (Local, GitHub Issues), the key doesn't matter.
	const sampleKey =
		tracker.kind === 'jira'
			? config.jira.default_project
				? `${config.jira.default_project}-1`
				: undefined
			: undefined;

	const transitionsResult = await tracker.adapter.listStatuses(sampleKey ?? 'sample');
	if (!transitionsResult.ok || transitionsResult.value.length === 0) {
		console.log(
			pc.yellow(
				`Could not load transitions from ${tracker.kind}. ` +
					'Falling back to manual config — edit .bode.yml by hand.'
			)
		);
		process.exit(1);
	}

	const available = transitionsResult.value;
	console.log('');
	console.log(pc.dim('Available transitions:'));
	for (const t of available) {
		const label = t.toStatusName ?? t.name;
		const arrow = t.name !== label ? ` → ${label}` : '';
		console.log(pc.dim(`  - ${t.name}${arrow}`));
	}
	console.log('');

	const phases: { key: TransitionKey; label: string; defaultName?: string }[] = [
		{ key: 'planning', label: 'When planning starts', defaultName: 'In Progress' },
		{ key: 'implementation', label: 'When implementation starts', defaultName: 'In Progress' },
		{ key: 'review', label: 'When AI review starts', defaultName: 'In Progress' },
		{
			key: 'awaiting_merge',
			label: 'When PR is opened (ready for human)',
			defaultName: 'Code Review',
		},
		{ key: 'done', label: 'When task is done', defaultName: 'Done' },
	];

	const skipValue = '__skip__';
	const picks: Record<string, string> = {};

	try {
		for (const phase of phases) {
			const choices = [
				{
					name: pc.dim('(skip — no Jira move at this event)'),
					value: skipValue,
				},
				...available.map((t) => ({
					name: t.toStatusName ? `${t.name} → ${t.toStatusName}` : t.name,
					value: t.toStatusName ?? t.name,
				})),
			];
			const def =
				phase.defaultName && available.some((t) => (t.toStatusName ?? t.name) === phase.defaultName)
					? phase.defaultName
					: skipValue;
			const picked = await askSelect<string>({
				message: `${phase.label}:`,
				choices,
				default: def,
			});
			if (picked === BACK) {
				handlePromptError(new Error('BACK'));
			}
			picks[phase.key] = picked === skipValue ? '' : (picked as string);
		}
	} catch (err) {
		handlePromptError(err);
		process.exit(1);
	}

	// Write to .bode.yml in workdir (preferred) — create or merge.
	const target = join(projectConfig.workdir, '.bode.yml');
	const existing: Record<string, unknown> = existsSync(target)
		? ((parseYaml(await readFile(target, 'utf-8')) as Record<string, unknown>) ?? {})
		: {};
	const existingJira = (existing['jira'] as Record<string, unknown> | undefined) ?? {};
	const updated = {
		...existing,
		jira: {
			...existingJira,
			transitions: picks,
		},
	};
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, stringifyYaml(updated), 'utf-8');

	console.log('');
	console.log(pc.green(`✓ Saved transitions to ${target}`));
	console.log('');
	console.log(pc.dim('Picks:'));
	for (const [k, v] of Object.entries(picks)) {
		console.log(pc.dim(`  ${k.padEnd(18)} ${v || '(skip)'}`));
	}
}
