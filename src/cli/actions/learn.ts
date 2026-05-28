import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '~/config/loader.ts';
import { loadSkillPrompt } from '~/skills/resolver.ts';
import { buildPrompt } from '~/skills/prompt-builder.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { writeText } from '~/utils/fs.ts';

export async function learnAction(options: {
	refresh?: boolean;
	detailed?: boolean;
}): Promise<void> {
	const workdir = process.cwd();
	const outDir = join(workdir, '.bode');
	const outPath = join(outDir, 'context.md');
	if (existsSync(outPath) && !options.refresh) {
		console.log(pc.yellow(`${outPath} already exists. Use --refresh to regenerate.`));
		return;
	}

	const configResult = await loadConfig(workdir);
	if (!configResult.ok) throw configResult.error;
	const phaseConfig = configResult.value.phases.planning;
	const adapterResult = getAdapter(phaseConfig.cli);
	if (!adapterResult.ok) throw adapterResult.error;
	const skill = await loadSkillPrompt('learn', {
		projectRoot: workdir,
		globalDir: undefined,
		cli: phaseConfig.cli,
	});
	if (!skill.ok) throw skill.error;

	const prompt = buildPrompt(skill.value, {
		jiraIssue: {
			key: 'LEARN',
			summary: options.detailed ? 'Generate detailed project context' : 'Generate project context',
			description: `Workdir: ${workdir}`,
			status: 'local',
			issueType: 'Task',
			assignee: null,
			labels: [],
			url: '',
		},
		projectAgentsMd: undefined,
		repoFileTree: undefined,
		priorArtifact: undefined,
		artifactPath: outPath,
		phaseName: 'planning',
		mainWorkdir: workdir,
	});

	mkdirSync(outDir, { recursive: true });
	const result = await adapterResult.value.invoke(prompt, phaseConfig, {
		interactive: true,
		workdir,
	});
	if (!result.ok) throw result.error;
	if (!existsSync(outPath) && result.value.stdout.trim())
		await writeText(outPath, result.value.stdout);
	console.log(pc.green(`Project context written to ${outPath}`));
}
