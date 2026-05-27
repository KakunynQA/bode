import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { readFile } from 'node:fs/promises';
import { projectConfigSchema, type ProjectConfig } from './schema.ts';
import { getProjectsDir } from './defaults.ts';
import type { Result } from '~/types/result.ts';

export async function listProjects(): Promise<Result<ProjectConfig[]>> {
	const dir = getProjectsDir();
	if (!existsSync(dir)) return { ok: true, value: [] };

	try {
		const files = await readdir(dir);
		const projects: ProjectConfig[] = [];

		for (const file of files) {
			if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
			const raw = await readFile(join(dir, file), 'utf-8');
			const parsed = parseYaml(raw);
			const validated = projectConfigSchema.safeParse(parsed);
			if (validated.success) {
				projects.push(validated.data);
			}
		}

		return { ok: true, value: projects };
	} catch (error) {
		return { ok: false, error: error as Error };
	}
}

export async function loadProjectConfig(name: string): Promise<Result<ProjectConfig | null>> {
	const dir = getProjectsDir();

	for (const ext of ['.yml', '.yaml'] as const) {
		const path = join(dir, `${name}${ext}`);
		if (!existsSync(path)) continue;

		try {
			const raw = await readFile(path, 'utf-8');
			const parsed = parseYaml(raw);
			const validated = projectConfigSchema.safeParse(parsed);
			if (!validated.success) {
				const errors = validated.error.issues
					.map((i) => `${i.path.join('.')}: ${i.message}`)
					.join('; ');
				return { ok: false, error: new Error(`Invalid project config "${name}": ${errors}`) };
			}
			return { ok: true, value: validated.data };
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}

	return { ok: true, value: null };
}
