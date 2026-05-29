import { flavorForCli, resolveSkillPath } from '~/skills/resolver.ts';
import { loadConfig } from '~/config/loader.ts';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { cp, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSkillsDir } from '~/config/defaults.ts';
import pc from 'picocolors';

const PHASES = ['planning', 'plan-review', 'implementation', 'review', 'learn', 'init-agents'];

export async function skillsAction(options: {
	project?: string;
	subcommand?: string;
	args?: string[];
}): Promise<void> {
	if (options.subcommand) {
		await manageSkills(options.subcommand, options.args ?? []);
		return;
	}
	const configResult = await loadConfig(options.project);
	const config = configResult.ok ? configResult.value : null;
	for (const phase of PHASES) {
		const phaseConfig =
			phase === 'plan-review'
				? config?.phases.plan_review
				: phase === 'planning' || phase === 'implementation' || phase === 'review'
					? config?.phases[phase]
					: config?.phases.planning;
		const opts: { projectRoot: string | undefined; globalDir: string | undefined; cli?: string } = {
			projectRoot: options.project,
			globalDir: undefined,
		};
		if (phaseConfig?.cli) opts.cli = phaseConfig.cli;
		const result = await resolveSkillPath(phase, opts);
		if (result.ok) {
			console.log(
				`${pc.bold(phase)}: ${pc.cyan(result.value)} ${pc.dim(`(${flavorForCli(phaseConfig?.cli)})`)}`
			);
		} else {
			console.log(`${pc.bold(phase)}: ${pc.yellow('not found')}`);
		}
	}
}

async function manageSkills(subcommand: string, args: string[]): Promise<void> {
	switch (subcommand) {
		case 'list':
			await listInstalledSkills();
			return;
		case 'install':
			await installSkill(args[0]);
			return;
		case 'remove':
			removeSkill(args[0]);
			return;
		case 'search':
			await searchSkills(args[0] ?? '');
			return;
		case 'audit':
			await listInstalledSkills();
			return;
		case 'update':
			console.log(pc.dim('Community skills are pinned by source. Re-run install to update.'));
			return;
		default:
			console.error(pc.red(`Unknown skills command: ${subcommand}`));
			process.exit(1);
	}
}

async function installSkill(source: string | undefined): Promise<void> {
	if (!source) throw new Error('Usage: bode skills install <repo>#<path>');
	const [, sourcePath] = source.split('#');
	if (!sourcePath) throw new Error('Skill source must use <repo>#<path>');
	const localSource = join(process.cwd(), sourcePath);
	if (!existsSync(localSource))
		throw new Error(`Only local fixture installs are supported here: ${localSource}`);
	const slug = sourcePath.split(/[\\/]/).filter(Boolean).pop() ?? 'skill';
	const dest = join(getSkillsDir(), slug);
	mkdirSync(getSkillsDir(), { recursive: true });
	await cp(localSource, dest, { recursive: true, force: true });
	writeFileSync(
		join(dest, '.install.json'),
		JSON.stringify({ source, installed_at: new Date().toISOString(), version: 'local' }, null, 2)
	);
	console.log(pc.green(`Installed ${slug} to ${dest}`));
}

async function listInstalledSkills(): Promise<void> {
	if (!existsSync(getSkillsDir())) {
		console.log(pc.dim('No global skills installed.'));
		return;
	}
	for (const entry of await readdir(getSkillsDir())) console.log(entry);
}

function removeSkill(slug: string | undefined): void {
	if (!slug) throw new Error('Usage: bode skills remove <slug>');
	rmSync(join(getSkillsDir(), slug), { recursive: true, force: true });
	console.log(pc.green(`Removed ${slug}`));
}

async function searchSkills(query: string): Promise<void> {
	const dir = join(process.cwd(), 'skills', 'community');
	if (!existsSync(dir)) return;
	for (const entry of await readdir(dir)) {
		const readme = join(dir, entry, 'README.md');
		if (!existsSync(readme)) continue;
		const text = await readFile(readme, 'utf-8');
		if (!query || text.toLowerCase().includes(query.toLowerCase())) console.log(entry);
	}
}
