import { select } from '@inquirer/prompts';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { listProjects, loadProjectConfig } from '~/config/projects.ts';
import { mergeProjectConfig } from '~/config/loader.ts';
import { projectConfigSchema, type BodeConfig, type ProjectConfig } from '~/config/schema.ts';
import { getProjectsDir } from '~/config/defaults.ts';
import { ensureDir } from '~/utils/fs.ts';
import type { Result } from '~/types/result.ts';

export type ResolvedProject = {
	config: BodeConfig;
	projectConfig: ProjectConfig;
};

/**
 * Project resolution priority (v0.20.0):
 *   1. `.bode.yml` in the current working directory (or nearest ancestor)
 *   2. Named project via `--project` flag → ~/.bode/projects/<name>.yml
 *   3. Default project from global config
 *   4. Interactive picker over ~/.bode/projects/
 *
 * The repo-local `.bode.yml` is the new preferred location for new users —
 * config travels with the repo, works without any global setup. The global
 * `~/.bode/projects/` style remains supported (legacy + multi-repo use).
 */
async function loadRepoLocalProject(cwd: string): Promise<ProjectConfig | null> {
	let dir = cwd;
	while (true) {
		const candidate = join(dir, '.bode.yml');
		if (existsSync(candidate)) {
			try {
				const raw = await readFile(candidate, 'utf-8');
				const parsed = parseYaml(raw);
				// `.bode.yml` lives in the repo; default workdir = the dir containing it.
				if (parsed && typeof parsed === 'object') {
					const withDefaults = { workdir: dir, name: 'repo-local', ...parsed };
					const result = projectConfigSchema.safeParse(withDefaults);
					if (result.success) return result.data;
				}
			} catch {
				// fall through
			}
			return null;
		}
		const parent = join(dir, '..');
		if (parent === dir) return null;
		dir = parent;
	}
}

export async function resolveProject(
	config: BodeConfig,
	options: { projectName?: string | undefined; cwd?: string | undefined }
): Promise<Result<ResolvedProject>> {
	const cwd = options.cwd ?? process.cwd();

	// Repo-local .bode.yml wins when --project is not explicitly set.
	if (!options.projectName) {
		const repoLocal = await loadRepoLocalProject(cwd);
		if (repoLocal) {
			return {
				ok: true,
				value: { config: mergeProjectConfig(config, repoLocal), projectConfig: repoLocal },
			};
		}
	}

	const projectsResult = await listProjects();
	if (!projectsResult.ok) return projectsResult;

	const projects = projectsResult.value;

	// v0.23.0: when no project is configured anywhere (no .bode.yml in cwd or
	// ancestors, no entries in ~/.bode/projects/), synthesize a minimal project
	// pointing at the cwd. Lets `bode <prompt>` and `bode KD-X` work in any git
	// repo without setup. The synthetic project name is "auto" and workdir is
	// the cwd; default_branch falls back to "main".
	if (projects.length === 0 && !options.projectName) {
		const synthetic: ProjectConfig = {
			name: 'auto',
			workdir: cwd,
			default_branch: 'main',
		};
		return {
			ok: true,
			value: { config: mergeProjectConfig(config, synthetic), projectConfig: synthetic },
		};
	}

	if (projects.length === 0) {
		return {
			ok: false,
			error: new Error(
				`Project "${options.projectName}" not configured. Either:\n` +
					`  - add a .bode.yml to ${cwd} (or an ancestor directory), or\n` +
					'  - run "bode setup-project" to create one in ~/.bode/projects/'
			),
		};
	}

	let selectedName: string;

	if (options.projectName) {
		selectedName = options.projectName;
	} else if (config.defaults?.project) {
		selectedName = config.defaults.project;
	} else {
		const choices = projects.map((p) => ({
			name: `${p.name} (${p.workdir})`,
			value: p.name,
		}));

		if (choices.length === 1) {
			selectedName = choices[0]!.value;
		} else {
			selectedName = await select({
				message: 'Which project?',
				choices,
			});
		}
	}

	const projectResult = await loadProjectConfig(selectedName);
	if (!projectResult.ok) return projectResult;

	const projectCfg = projectResult.value;
	if (!projectCfg) {
		return {
			ok: false,
			error: new Error(`Project "${selectedName}" not found in ~/.bode/projects/`),
		};
	}

	const mergedConfig = mergeProjectConfig(config, projectCfg);

	return { ok: true, value: { config: mergedConfig, projectConfig: projectCfg } };
}

export async function saveProjectConfig(project: ProjectConfig): Promise<Result<void>> {
	const { writeText } = await import('~/utils/fs.ts');
	const dir = getProjectsDir();
	await ensureDir(dir);

	const yaml = projectConfigToYaml(project);
	const path = `${dir}/${project.name}.yml`;
	await writeText(path, yaml);

	return { ok: true, value: undefined };
}

function projectConfigToYaml(p: ProjectConfig): string {
	const lines: string[] = [`name: ${p.name}`, `workdir: ${p.workdir}`];

	if (p.default_branch) {
		lines.push(`default_branch: ${p.default_branch}`);
	}

	if (p.vcs_provider) {
		lines.push(`vcs_provider: ${p.vcs_provider}`);
	}

	if (p.jira?.site || p.jira?.default_project) {
		lines.push('jira:');
		if (p.jira.site) lines.push(`  site: ${p.jira.site}`);
		if (p.jira.default_project) lines.push(`  default_project: ${p.jira.default_project}`);
	}

	if (p.context_files?.length) {
		lines.push('context_files:');
		for (const cf of p.context_files) {
			lines.push(`  - ${cf}`);
		}
	}

	if (p.project_context_path) {
		lines.push(`project_context_path: ${p.project_context_path}`);
	}

	if (p.context_investigated_at) {
		lines.push(`context_investigated_at: ${p.context_investigated_at}`);
	}

	if (p.phases) {
		lines.push('phases:');
		for (const [phase, cfg] of Object.entries(p.phases)) {
			if (!cfg) continue;
			lines.push(`  ${phase}:`);
			if (cfg.cli) lines.push(`    cli: ${cfg.cli}`);
			if (cfg.model) lines.push(`    model: ${cfg.model}`);
			if (cfg.skill) lines.push(`    skill: ${cfg.skill}`);
			if (cfg.timeout_minutes) lines.push(`    timeout_minutes: ${cfg.timeout_minutes}`);
		}
	}

	if (p.branch_tool) {
		lines.push(`branch_tool: ${p.branch_tool}`);
	}

	if (p.repos?.length) {
		lines.push('repos:');
		for (const r of p.repos) {
			lines.push(`  - workdir: ${r.workdir}`);
			if (r.name) lines.push(`    name: ${r.name}`);
		}
	}

	return lines.join('\n') + '\n';
}
