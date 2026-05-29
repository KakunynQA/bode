import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { getProjectsDir } from '~/config/defaults.ts';
import { ensureDir, writeText } from '~/utils/fs.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { loadSkillPrompt } from '~/skills/resolver.ts';
import { buildPrompt } from '~/skills/prompt-builder.ts';
import { askSelect } from '~/utils/prompt.ts';
import { BACK } from '~/utils/prompt.ts';

export type InvestigateOptions = {
	workdir: string;
	projectName: string;
	sharedInRepo: boolean;
	cliName: string;
	model: string;
	timeoutMinutes: number;
};

export type InvestigateResult = {
	path: string;
	investigatedAt: string;
};

/**
 * Resolves the absolute destination path for the project's PROJECT_CONTEXT.md.
 * Shared-in-repo writes alongside the workdir (committable). Default writes
 * to ~/.bode/projects/<name>/PROJECT_CONTEXT.md (private cache).
 */
export function resolveProjectContextPath(
	projectName: string,
	workdir: string,
	sharedInRepo: boolean
): string {
	if (sharedInRepo) return join(workdir, 'PROJECT_CONTEXT.md');
	return join(getProjectsDir(), projectName, 'PROJECT_CONTEXT.md');
}

/**
 * Runs the configured AI CLI/model against `workdir` and writes the result
 * to PROJECT_CONTEXT.md at the resolved path. Reuses the bundled `learn`
 * skill prompt — the intent is identical (summarize the project for future
 * context injection). Stdio is inherited so the user watches the run.
 */
export async function investigateProjectContext(
	opts: InvestigateOptions
): Promise<InvestigateResult> {
	const target = resolveProjectContextPath(opts.projectName, opts.workdir, opts.sharedInRepo);

	if (existsSync(target)) {
		const overwrite = await askSelect<'yes' | 'no'>({
			message: `${target} already exists. Overwrite?`,
			default: 'no',
			choices: [
				{ name: 'No, keep existing file', value: 'no' },
				{ name: 'Yes, overwrite', value: 'yes' },
			],
		});
		if (overwrite === BACK || overwrite === 'no') {
			console.log(pc.dim(`Keeping existing ${target}`));
			return {
				path: target,
				investigatedAt: new Date().toISOString(),
			};
		}
	}

	const adapterResult = getAdapter(opts.cliName);
	if (!adapterResult.ok) throw adapterResult.error;

	const skill = await loadSkillPrompt('learn', {
		projectRoot: opts.workdir,
		globalDir: undefined,
		cli: opts.cliName,
	});
	if (!skill.ok) throw skill.error;

	const prompt = buildPrompt(skill.value, {
		jiraIssue: {
			key: 'PROJECT-CONTEXT',
			summary: `Investigate project context for ${opts.projectName}`,
			description: `Workdir: ${opts.workdir}. Produce a thorough PROJECT_CONTEXT.md covering stack, architecture, conventions, entry points, testing strategy, and anything non-obvious from existing CLAUDE.md / AGENTS.md files. Write to ${target}.`,
			status: 'local',
			issueType: 'Task',
			assignee: null,
			labels: [],
			url: '',
		},
		projectAgentsMd: undefined,
		repoFileTree: undefined,
		priorArtifact: undefined,
		artifactPath: target,
		phaseName: 'planning',
		mainWorkdir: opts.workdir,
	});

	if (opts.sharedInRepo) {
		await ensureDir(opts.workdir);
	} else {
		await ensureDir(join(getProjectsDir(), opts.projectName));
	}

	console.log(pc.dim(`→ Running ${opts.cliName} (${opts.model}) against ${opts.workdir}`));
	console.log(pc.dim(`  This may take a few minutes. Watch the AI output below.`));

	const result = await adapterResult.value.invoke(
		prompt,
		{ cli: opts.cliName, model: opts.model, timeout_minutes: opts.timeoutMinutes },
		{ interactive: true, workdir: opts.workdir }
	);
	if (!result.ok) throw result.error;

	if (!existsSync(target) && result.value.stdout.trim()) {
		await writeText(target, result.value.stdout);
	}

	if (!existsSync(target)) {
		throw new Error(
			`Investigation finished but no PROJECT_CONTEXT.md was written to ${target}. The AI may have written to a different location.`
		);
	}

	const investigatedAt = new Date().toISOString();
	console.log(pc.green(`✓ Project context written to ${target}`));
	return { path: target, investigatedAt };
}
