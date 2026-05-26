import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { bodeConfigSchema, type BodeConfig } from './schema.ts';
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
      const errors = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { ok: false, error: new Error(`Invalid config: ${errors}`) };
    }

    return { ok: true, value: validated.data };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
