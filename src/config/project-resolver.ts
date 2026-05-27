import { select } from '@inquirer/prompts';
import { listProjects, loadProjectConfig } from '~/config/projects.ts';
import { mergeProjectConfig } from '~/config/loader.ts';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import { getProjectsDir } from '~/config/defaults.ts';
import { ensureDir } from '~/utils/fs.ts';
import type { Result } from '~/types/result.ts';

export type ResolvedProject = {
	config: BodeConfig;
	projectConfig: ProjectConfig;
};

export async function resolveProject(
	config: BodeConfig,
	options: { projectName?: string | undefined }
): Promise<Result<ResolvedProject>> {
	const projectsResult = await listProjects();
	if (!projectsResult.ok) return projectsResult;

	const projects = projectsResult.value;

	if (projects.length === 0) {
		return {
			ok: false,
			error: new Error(
				'No projects configured. Run "bode setup project" to create one, or check ~/.bode/projects/'
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

	if (p.context_paths?.length) {
		lines.push('context_paths:');
		for (const cp of p.context_paths) {
			lines.push(`  - ${cp}`);
		}
	}

	if (p.context_files?.length) {
		lines.push('context_files:');
		for (const cf of p.context_files) {
			lines.push(`  - ${cf}`);
		}
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
