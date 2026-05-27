import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getSkillsDir } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';

declare const __SKILL_PLANNING__: string;
declare const __SKILL_IMPLEMENTATION__: string;
declare const __SKILL_REVIEW__: string;

const EMBEDDED_SKILL_TAG = 'embedded:';

const EMBEDDED_SKILLS: Record<string, () => string> = {
	planning: () => (typeof __SKILL_PLANNING__ !== 'undefined' ? __SKILL_PLANNING__ : ''),
	implementation: () =>
		typeof __SKILL_IMPLEMENTATION__ !== 'undefined' ? __SKILL_IMPLEMENTATION__ : '',
	review: () => (typeof __SKILL_REVIEW__ !== 'undefined' ? __SKILL_REVIEW__ : ''),
};

function getEmbeddedSkill(phase: string): string | null {
	const fn = EMBEDDED_SKILLS[phase];
	if (!fn) return null;
	const content = fn();
	return content && content.length > 0 ? content : null;
}

function getDevBundledPath(phase: string): string | null {
	if (typeof __dirname === 'undefined') return null;
	// Candidates cover: tsx dev (__dirname = src/skills), built CJS (__dirname = dist/),
	// and globally-installed package (src/skills/defaults shipped via "files" in package.json).
	const candidates = [
		join(__dirname, 'defaults', `${phase}.md`),
		join(__dirname, '..', 'src', 'skills', 'defaults', `${phase}.md`),
		join(__dirname, '..', 'skills', 'defaults', `${phase}.md`),
		join(__dirname, 'skills', 'defaults', `${phase}.md`),
	];
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return null;
}

export async function resolveSkillPath(
	phase: string,
	options: { projectRoot: string | undefined; globalDir: string | undefined }
): Promise<Result<string>> {
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

	const dev = getDevBundledPath(phase);
	if (dev) return { ok: true, value: dev };

	if (getEmbeddedSkill(phase)) {
		return { ok: true, value: `${EMBEDDED_SKILL_TAG}${phase}` };
	}

	return { ok: false, error: new Error(`No skill found for phase: ${phase}`) };
}

export async function loadSkillPrompt(
	phase: string,
	options: { projectRoot: string | undefined; globalDir: string | undefined }
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
