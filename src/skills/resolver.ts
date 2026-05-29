import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getSkillsDir } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';

function moduleDir(): string | null {
	if (typeof __dirname !== 'undefined') return __dirname;
	try {
		return dirname(fileURLToPath(import.meta.url));
	} catch {
		return null;
	}
}

declare const __SKILL_PLANNING__: string;
declare const __SKILL_IMPLEMENTATION__: string;
declare const __SKILL_REVIEW__: string;
declare const __SKILL_PLAN_REVIEW__: string;
declare const __SKILL_LEARN__: string;
declare const __SKILL_INIT_AGENTS__: string;

const EMBEDDED_SKILL_TAG = 'embedded:';

const EMBEDDED_SKILLS: Record<string, () => string> = {
	planning: () => (typeof __SKILL_PLANNING__ !== 'undefined' ? __SKILL_PLANNING__ : ''),
	'plan-review': () => (typeof __SKILL_PLAN_REVIEW__ !== 'undefined' ? __SKILL_PLAN_REVIEW__ : ''),
	implementation: () =>
		typeof __SKILL_IMPLEMENTATION__ !== 'undefined' ? __SKILL_IMPLEMENTATION__ : '',
	review: () => (typeof __SKILL_REVIEW__ !== 'undefined' ? __SKILL_REVIEW__ : ''),
	learn: () => (typeof __SKILL_LEARN__ !== 'undefined' ? __SKILL_LEARN__ : ''),
	'init-agents': () => (typeof __SKILL_INIT_AGENTS__ !== 'undefined' ? __SKILL_INIT_AGENTS__ : ''),
};

export type SkillFlavor = 'neutral' | 'claude' | 'openai';

export function flavorForCli(cli: string | undefined): SkillFlavor {
	if (cli === 'claude-code') return 'claude';
	if (cli === 'codex' || cli === 'opencode') return 'openai';
	return 'neutral';
}

function getEmbeddedSkill(phase: string): string | null {
	const fn = EMBEDDED_SKILLS[phase];
	if (!fn) return null;
	const content = fn();
	return content && content.length > 0 ? content : null;
}

function getDevBundledPath(phase: string, flavor: SkillFlavor): string | null {
	const base = moduleDir();
	if (!base) return null;
	const preferred = flavor === 'neutral' ? `${phase}.neutral.md` : `${phase}.${flavor}.md`;
	// Candidates cover: tsx dev (base = src/skills), built bundle (base = dist/),
	// and globally-installed package (src/skills/defaults shipped via "files" in package.json).
	const candidates = [
		join(base, 'defaults', preferred),
		join(base, 'defaults', `${phase}.md`),
		join(base, '..', 'src', 'skills', 'defaults', preferred),
		join(base, '..', 'src', 'skills', 'defaults', `${phase}.md`),
		join(base, '..', 'skills', 'defaults', preferred),
		join(base, '..', 'skills', 'defaults', `${phase}.md`),
		join(base, 'skills', 'defaults', preferred),
		join(base, 'skills', 'defaults', `${phase}.md`),
		join(base, 'defaults', `${phase}.neutral.md`),
		join(base, '..', 'src', 'skills', 'defaults', `${phase}.neutral.md`),
		join(base, '..', 'skills', 'defaults', `${phase}.neutral.md`),
		join(base, 'skills', 'defaults', `${phase}.neutral.md`),
	];
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return null;
}

export async function resolveSkillPath(
	phase: string,
	options: { projectRoot: string | undefined; globalDir: string | undefined; cli?: string }
): Promise<Result<string>> {
	const flavor = flavorForCli(options.cli);
	const projectSkill = options.projectRoot
		? join(options.projectRoot, '.bode', 'skills', `${phase}.md`)
		: null;
	const globalSkill = join(options.globalDir ?? getSkillsDir(), `${phase}.md`);

	if (projectSkill && existsSync(projectSkill)) {
		return { ok: true, value: projectSkill };
	}
	if (existsSync(globalSkill)) {
		return { ok: true, value: globalSkill };
	}

	const dev = getDevBundledPath(phase, flavor);
	if (dev) return { ok: true, value: dev };

	if (getEmbeddedSkill(phase)) {
		return { ok: true, value: `${EMBEDDED_SKILL_TAG}${phase}` };
	}

	return { ok: false, error: new Error(`No skill found for phase: ${phase}`) };
}

export async function loadSkillPrompt(
	phase: string,
	options: { projectRoot: string | undefined; globalDir: string | undefined; cli?: string }
): Promise<Result<string>> {
	const pathResult = await resolveSkillPath(phase, options);
	if (!pathResult.ok) return pathResult;

	const resolved = pathResult.value;
	if (resolved.startsWith(EMBEDDED_SKILL_TAG)) {
		const embeddedPhase = resolved.slice(EMBEDDED_SKILL_TAG.length);
		const content = getEmbeddedSkill(embeddedPhase);
		if (content) return { ok: true, value: content };
		return { ok: false, error: new Error(`Embedded skill missing: ${embeddedPhase}`) };
	}

	try {
		const content = await readFile(resolved, 'utf-8');
		return { ok: true, value: content };
	} catch (error) {
		return { ok: false, error: error as Error };
	}
}
