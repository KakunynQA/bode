import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { bodeConfigSchema, type BodeConfig, type ProjectConfig } from './schema.ts';
import type { VcsProvider } from '~/types/vcs.ts';
import { DEFAULT_CONFIG, getGlobalConfigPath } from './defaults.ts';
import type { Result } from '~/types/result.ts';
import { deepMerge } from '~/utils/merge.ts';
import { detectEnv } from './auto-detect.ts';

/**
 * Loads the bode configuration, with auto-detection fallback (v0.23.0).
 *
 * Resolution order:
 *   1. `~/.bode/config.yml` if it exists (merged onto DEFAULT_CONFIG).
 *   2. `.bode.yml` in projectRoot, if `projectRoot` is provided.
 *   3. If neither global YAML exists, the config is synthesized from
 *      `detectEnv(cwd)` — pick the first installed AI CLI, infer VCS
 *      provider from the git remote. This makes `bode "do X"` work on
 *      a fresh install without ever running `bode setup`.
 *
 * The auto-detect step only runs when there's NO global config. If the user
 * has a global config (even one with no Jira and default phases), we respect
 * it exactly — auto-detect is for new users, not a runtime override.
 */
export async function loadConfig(projectRoot?: string): Promise<Result<BodeConfig>> {
	try {
		const globalPath = getGlobalConfigPath();
		let config = DEFAULT_CONFIG;
		let autoDetected = false;

		if (existsSync(globalPath)) {
			const raw = await readFile(globalPath, 'utf-8');
			const parsed = parseYaml(raw);
			config = deepMerge(DEFAULT_CONFIG, parsed) as BodeConfig;
		} else {
			// Zero-config first run: synthesize defaults from the environment.
			config = await buildSyntheticConfig(projectRoot ?? process.cwd());
			autoDetected = true;
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

		const result = validated.data;
		if (autoDetected) {
			Object.defineProperty(result, '__autoDetected', {
				value: true,
				enumerable: false,
				configurable: true,
			});
		}
		return { ok: true, value: result };
	} catch (error) {
		return { ok: false, error: error as Error };
	}
}

/**
 * Builds a BodeConfig from the detected environment when no global config
 * exists. Picks the first available AI CLI on PATH for all phases, infers VCS
 * from the git remote. Result is a complete, valid config ready to run.
 */
export async function buildSyntheticConfig(workdir: string): Promise<BodeConfig> {
	const env = await detectEnv(workdir, { globalConfigPath: getGlobalConfigPath() });
	const cli = env.availableAiCli ?? 'claude-code';
	const model = defaultModelFor(cli);

	const phases: BodeConfig['phases'] = {
		planning: { cli, model, timeout_minutes: 15 },
		implementation: { cli, model, timeout_minutes: 60 },
		review: { cli, model, timeout_minutes: 10 },
	};

	const synthetic: BodeConfig = {
		...DEFAULT_CONFIG,
		phases,
		...(env.vcsProvider ? { vcs: { provider: env.vcsProvider } } : {}),
	};

	return synthetic;
}

function defaultModelFor(cli: string): string {
	switch (cli) {
		case 'claude-code':
			return 'claude-opus-4-7';
		case 'codex':
			return 'gpt-5.5';
		case 'opencode':
			return 'claude-sonnet-4-6';
		default:
			return 'claude-opus-4-7';
	}
}

export function isAutoDetectedConfig(config: BodeConfig): boolean {
	return (config as unknown as { __autoDetected?: boolean }).__autoDetected === true;
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
