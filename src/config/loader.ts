import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { bodeConfigSchema, type BodeConfig, type ProjectConfig } from './schema.ts';
import type { VcsProvider } from '~/types/vcs.ts';
import { DEFAULT_CONFIG, getGlobalConfigPath } from './defaults.ts';
import type { Result } from '~/types/result.ts';
import { deepMerge } from '~/utils/merge.ts';

export async function loadConfig(projectRoot?: string): Promise<Result<BodeConfig>> {
	try {
		const globalPath = getGlobalConfigPath();
		let config = DEFAULT_CONFIG;

		if (existsSync(globalPath)) {
			const raw = await readFile(globalPath, 'utf-8');
			const parsed = parseYaml(raw);
			config = deepMerge(DEFAULT_CONFIG, parsed) as BodeConfig;
		}

		if (projectRoot) {
			const projectPath = join(projectRoot, '.bode.yml');
			if (existsSync(projectPath)) {
				const raw = await readFile(projectPath, 'utf-8');
				const parsed = parseYaml(raw);
				config = deepMerge(config, parsed) as BodeConfig;
			}
		}

		const validated = bodeConfigSchema.safeParse(config);
		if (!validated.success) {
			const errors = validated.error.issues
				.map((i) => `${i.path.join('.')}: ${i.message}`)
				.join('; ');
			return { ok: false, error: new Error(`Invalid config: ${errors}`) };
		}

		return { ok: true, value: validated.data };
	} catch (error) {
		return { ok: false, error: error as Error };
	}
}

export function mergeProjectConfig(config: BodeConfig, project: ProjectConfig): BodeConfig {
	const merged = { ...config };

	if (project.jira?.site) {
		merged.jira = { ...merged.jira, site: project.jira.site };
	}
	if (project.jira?.default_project) {
		merged.jira = { ...merged.jira, default_project: project.jira.default_project };
	}

	if (project.phases) {
		merged.phases = {
			planning: project.phases.planning
				? mergePhaseConfig(merged.phases.planning, project.phases.planning)
				: merged.phases.planning,
			implementation: project.phases.implementation
				? mergePhaseConfig(merged.phases.implementation, project.phases.implementation)
				: merged.phases.implementation,
			review: project.phases.review
				? mergePhaseConfig(merged.phases.review, project.phases.review)
				: merged.phases.review,
		};
	}

	return merged;
}

export function resolveVcsProvider(config: BodeConfig, project?: ProjectConfig): VcsProvider {
	return project?.vcs_provider ?? config.vcs?.provider ?? 'github';
}

function mergePhaseConfig(
	base: { cli: string; model: string; timeout_minutes: number; skill?: string | undefined },
	override: Record<string, unknown>
): { cli: string; model: string; timeout_minutes: number; skill?: string | undefined } {
	return {
		cli: (override['cli'] as string | undefined) ?? base.cli,
		model: (override['model'] as string | undefined) ?? base.model,
		timeout_minutes: (override['timeout_minutes'] as number | undefined) ?? base.timeout_minutes,
		...(override['skill'] !== undefined ? { skill: override['skill'] as string } : {}),
		...(base.skill !== undefined && override['skill'] === undefined ? { skill: base.skill } : {}),
	};
}
