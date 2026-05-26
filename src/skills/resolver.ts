import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getSkillsDir } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const BUNDLED_SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'defaults');

export async function resolveSkillPath(
  phase: string,
  options: { projectRoot: string | undefined; globalDir: string | undefined }
): Promise<Result<string>> {
  const projectSkill = options.projectRoot
    ? join(options.projectRoot, '.bode', 'skills', `${phase}.md`)
    : null;
  const globalSkill = join(options.globalDir ?? getSkillsDir(), `${phase}.md`);
  const bundledSkill = join(BUNDLED_SKILLS_DIR, `${phase}.md`);

  if (projectSkill && existsSync(projectSkill)) {
    return { ok: true, value: projectSkill };
  }
  if (existsSync(globalSkill)) {
    return { ok: true, value: globalSkill };
  }
  if (existsSync(bundledSkill)) {
    return { ok: true, value: bundledSkill };
  }

  return { ok: false, error: new Error(`No skill found for phase: ${phase}`) };
}

export async function loadSkillPrompt(
  phase: string,
  options: { projectRoot: string | undefined; globalDir: string | undefined }
): Promise<Result<string>> {
  const pathResult = await resolveSkillPath(phase, options);
  if (!pathResult.ok) return pathResult;

  try {
    const content = await readFile(pathResult.value, 'utf-8');
    return { ok: true, value: content };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
