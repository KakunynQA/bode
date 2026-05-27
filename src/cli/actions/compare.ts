import pc from 'picocolors';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadConfig } from '~/config/loader.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { selectTracker } from '~/adapters/tracker/factory.ts';
import { buildPrompt } from '~/skills/prompt-builder.ts';
import { loadSkillPrompt } from '~/skills/resolver.ts';

/**
 * Agent comparison mode (#26).
 *
 * Runs the SAME phase against TWO different AI CLIs (or two different models
 * on the same CLI), captures the artifacts, and writes a side-by-side diff
 * file under `~/.bode/comparisons/<task>-<timestamp>/`.
 *
 *   bode compare KD-312 --agents claude-code,codex
 *   bode compare "fix bug" --agents claude-code:claude-opus-4-7,codex:gpt-5.5
 *
 * Both runs are headless (no interactive terminal handoff) so they can run
 * back-to-back without user input. Useful for "which agent handles this
 * codebase best" experiments.
 *
 * This is the planning phase only. For full-flow comparison see Wave 6.
 */
export async function compareAction(
	taskKey: string,
	options: {
		agents?: string;
		project?: string;
	}
): Promise<void> {
	const agentSpec = options.agents?.trim();
	if (!agentSpec) {
		console.error(pc.red('--agents <list> is required'));
		console.error(pc.dim('Example: --agents claude-code,codex'));
		console.error(pc.dim('         --agents claude-code:claude-opus-4-7,codex:gpt-5.5'));
		process.exit(1);
	}

	const specs = agentSpec
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (specs.length < 2) {
		console.error(pc.red('Need at least two agents to compare. Got: ' + specs.length));
		process.exit(1);
	}

	const configResult = await loadConfig();
	if (!configResult.ok) {
		console.error(pc.red(`Configuration error: ${configResult.error.message}`));
		process.exit(1);
	}
	const projectResult = await resolveProject(configResult.value, { projectName: options.project });
	if (!projectResult.ok) {
		console.error(pc.red(projectResult.error.message));
		process.exit(1);
	}

	const { config, projectConfig } = projectResult.value;
	const tracker = selectTracker({
		jira: config.jira,
		workdir: projectConfig.workdir,
		...(config.linear ? { linear: config.linear } : {}),
		...(config.notion ? { notion: config.notion } : {}),
		...(config.trello ? { trello: config.trello } : {}),
	});

	const issueResult = await tracker.adapter.fetchTask(taskKey);
	if (!issueResult.ok) {
		console.error(pc.red(`Tracker error: ${issueResult.error.message}`));
		process.exit(1);
	}

	const skill = await loadSkillPrompt('planning', {
		projectRoot: projectConfig.workdir,
		globalDir: undefined,
	});
	if (!skill.ok) {
		console.error(pc.red(`Skill load failed: ${skill.error.message}`));
		process.exit(1);
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').slice(0, 19);
	const outDir = join(homedir(), '.bode', 'comparisons', `${taskKey}-${timestamp}`);
	await mkdir(outDir, { recursive: true });

	console.log(pc.cyan(`Comparing ${specs.length} agents on planning phase for ${taskKey}`));
	console.log(pc.dim(`Output: ${outDir}`));
	console.log('');

	const results: { spec: string; artifact: string; exitCode: number; durationMs: number }[] = [];

	for (const spec of specs) {
		const [cli, model] = spec.includes(':') ? spec.split(':') : [spec, undefined];
		const cliName = cli ?? '';
		const adapterR = getAdapter(cliName);
		if (!adapterR.ok) {
			console.error(pc.red(`✗ ${spec}: ${adapterR.error.message}`));
			continue;
		}

		const phaseConfig = config.phases.planning;
		const useModel = model ?? phaseConfig.model;
		const prompt = buildPrompt(skill.value, {
			jiraIssue: issueResult.value,
			projectAgentsMd: undefined,
			repoFileTree: undefined,
			priorArtifact: undefined,
		});

		console.log(pc.dim(`Running ${spec}...`));
		const start = Date.now();
		const invokeR = await adapterR.value.invoke(
			prompt,
			{ cli: cliName, model: useModel, timeout_minutes: phaseConfig.timeout_minutes },
			{ interactive: false, workdir: projectConfig.workdir }
		);
		const durationMs = Date.now() - start;
		if (!invokeR.ok) {
			console.error(pc.red(`  ✗ ${spec} failed: ${invokeR.error.message}`));
			results.push({
				spec,
				artifact: `(failed: ${invokeR.error.message})`,
				exitCode: -1,
				durationMs,
			});
			continue;
		}
		const safe = spec.replace(/[^a-z0-9]+/gi, '-');
		const path = join(outDir, `${safe}.md`);
		await writeFile(path, invokeR.value.stdout, 'utf-8');
		console.log(pc.green(`  ✓ ${spec} → ${path} (${invokeR.value.durationMs}ms)`));
		results.push({
			spec,
			artifact: invokeR.value.stdout,
			exitCode: invokeR.value.exitCode,
			durationMs: invokeR.value.durationMs,
		});
	}

	const summaryPath = join(outDir, 'summary.md');
	const summary =
		`# Agent comparison — ${taskKey}\n\n` +
		`Date: ${new Date().toISOString()}\n` +
		`Phase: planning\n\n` +
		results
			.map(
				(r) =>
					`## ${r.spec}\n\n` +
					`- exit code: ${r.exitCode}\n` +
					`- duration: ${r.durationMs}ms\n` +
					`- bytes: ${r.artifact.length}\n`
			)
			.join('\n');
	await writeFile(summaryPath, summary, 'utf-8');

	console.log('');
	console.log(pc.bold('Done.'));
	console.log(pc.dim(`Summary: ${summaryPath}`));
	console.log(pc.dim(`Individual artifacts in ${outDir}/`));
}
