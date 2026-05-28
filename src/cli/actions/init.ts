import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '~/config/loader.ts';
import { loadSkillPrompt } from '~/skills/resolver.ts';
import { buildPrompt } from '~/skills/prompt-builder.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { writeText } from '~/utils/fs.ts';

export async function initAction(options: { overwrite?: boolean; from?: string }): Promise<void> {
	const workdir = process.cwd();
	const outPath = join(workdir, 'AGENTS.md');
	if (existsSync(outPath) && !options.overwrite) {
		console.error(pc.yellow('AGENTS.md already exists. Use --overwrite to regenerate.'));
		process.exit(1);
	}

	const configResult = await loadConfig(workdir);
	if (!configResult.ok) throw configResult.error;
	const phaseConfig = configResult.value.phases.planning;
	const adapterResult = getAdapter(phaseConfig.cli);
	if (!adapterResult.ok) throw adapterResult.error;
	const skill = await loadSkillPrompt('init-agents', {
		projectRoot: workdir,
		globalDir: undefined,
		cli: phaseConfig.cli,
	});
	if (!skill.ok) throw skill.error;

	const importedRules =
		options.from && existsSync(join(workdir, options.from))
			? readFileSync(join(workdir, options.from), 'utf-8')
			: undefined;
	const prompt = buildPrompt(skill.value, {
		jiraIssue: {
			key: 'INIT',
			summary: 'Scaffold AGENTS.md',
			description: `Workdir: ${workdir}`,
			status: 'local',
			issueType: 'Task',
			assignee: null,
			labels: [],
			url: '',
		},
		projectAgentsMd: importedRules,
		repoFileTree: undefined,
		priorArtifact: undefined,
		artifactPath: outPath,
		phaseName: 'planning',
		mainWorkdir: workdir,
	});

	mkdirSync(workdir, { recursive: true });
	const result = await adapterResult.value.invoke(prompt, phaseConfig, {
		interactive: true,
		workdir,
	});
	if (!result.ok) throw result.error;
	if (!existsSync(outPath) && result.value.stdout.trim())
		await writeText(outPath, result.value.stdout);
	console.log(pc.green(`AGENTS.md written to ${outPath}`));
}
