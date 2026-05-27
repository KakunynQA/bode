import pc from 'picocolors';
import ora from 'ora';
import { select, input, password } from '@inquirer/prompts';
import { getGlobalDir, getGlobalConfigPath } from '~/config/defaults.ts';
import { existsSync } from 'node:fs';
import { ensureDir, writeText, chmodSensitive } from '~/utils/fs.ts';
import { loadConfig } from '~/config/loader.ts';
import { listAdapterNames } from '~/adapters/cli/registry.ts';
import { getModelsForCli } from '~/adapters/cli/models.ts';
import { listProjects, loadProjectConfig } from '~/config/projects.ts';
import { saveProjectConfig } from '~/config/project-resolver.ts';
import type { ProjectConfig } from '~/config/schema.ts';
import { createCancelSignal, handlePromptError, BACK } from '~/utils/prompt.ts';
import { testJiraConnection } from '~/adapters/jira/rest.ts';
import { getVersion } from '~/utils/version.ts';

type WizardStep<T = unknown> = () => Promise<T | typeof BACK>;

async function runWizard(steps: WizardStep[], results: unknown[]): Promise<void> {
	let cursor = 0;

	while (cursor < steps.length) {
		const step = steps[cursor]!;
		const result = await step();
		if (result === BACK) {
			cursor = Math.max(0, cursor - 1);
		} else {
			results[cursor] = result;
			cursor++;
		}
	}
}

async function withSignal<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
	const { signal, cleanup } = createCancelSignal();
	try {
		return await fn(signal);
	} catch (err) {
		handlePromptError(err, cleanup);
		throw err;
	} finally {
		cleanup();
	}
}

async function selectCli(
	question: string,
	defaultCli: string,
	signal: AbortSignal
): Promise<string | typeof BACK> {
	const adapters = listAdapterNames();
	const choices: { name: string; value: string | typeof BACK; description?: string }[] =
		adapters.map((name) => ({
			name,
			value: name,
			description: cliDescription(name),
		}));
	choices.push({ name: pc.dim('← Back'), value: BACK, description: 'Go to previous question' });

	return select(
		{
			message: question,
			default: defaultCli,
			choices,
		},
		{ signal }
	) as Promise<string | typeof BACK>;
}

async function selectModel(
	cliName: string,
	currentModel: string,
	signal: AbortSignal
): Promise<string | typeof BACK> {
	const models = getModelsForCli(cliName);
	if (models.length === 0) {
		return input(
			{
				message: 'Model:',
				default: currentModel,
			},
			{ signal }
		);
	}

	const choices: { name: string; value: string | typeof BACK; description?: string }[] = models.map(
		(m) => ({
			name: m,
			value: m,
		})
	);

	choices.push({
		name: pc.dim('(other — type manually)'),
		value: '__custom__',
	});
	choices.push({
		name: pc.dim('← Back'),
		value: BACK,
		description: 'Go to previous question',
	});

	const chosen = await select(
		{
			message: 'Model:',
			default: currentModel,
			choices,
		},
		{ signal }
	);

	if (chosen === BACK) return BACK;
	if (chosen === '__custom__') {
		return input(
			{
				message: 'Custom model name:',
				default: currentModel,
			},
			{ signal }
		);
	}

	return chosen;
}

function cliDescription(name: string): string {
	switch (name) {
		case 'claude-code':
			return 'Anthropic Claude Code CLI';
		case 'opencode':
			return 'OpenCode (multi-provider)';
		case 'codex':
			return 'OpenAI Codex CLI';
		case 'zai':
			return 'Z.AI Coding CLI';
		default:
			return '';
	}
}

export async function setupAction(subcommand?: string): Promise<void> {
	if (subcommand === 'project') {
		await setupProjectAction();
		return;
	}

	console.log(__GOAT_ART__);
	console.log(pc.bold(pc.cyan(`  Bode Setup Wizard v${getVersion()}\n`)));

	const globalDir = getGlobalDir();
	await ensureDir(globalDir);
	await ensureDir(`${globalDir}/runs`);
	await ensureDir(`${globalDir}/skills`);
	await ensureDir(`${globalDir}/projects`);
	console.log(pc.green(`✓ Created ${globalDir}\n`));

	const existingConfig = existsSync(getGlobalConfigPath());

	let currentJiraSite = '';
	let currentProject = '';
	let currentJiraEmail = '';
	let currentJiraToken = '';
	let currentGithubOrg = '';
	let currentPlanningCli = 'claude-code';
	let currentPlanningModel = 'claude-opus-4-7';
	let currentImplCli = 'opencode';
	let currentImplModel = 'claude-sonnet-4-6';
	let currentReviewCli = 'opencode';
	let currentReviewModel = 'claude-sonnet-4-6';

	if (existingConfig) {
		const loadResult = await loadConfig();
		if (loadResult.ok) {
			const cfg = loadResult.value;
			currentJiraSite = cfg.jira.site;
			currentProject = cfg.jira.default_project;
			currentJiraEmail = cfg.jira.email ?? '';
			currentJiraToken = cfg.jira.api_token ?? '';
			currentGithubOrg = cfg.github?.default_org ?? '';
			currentPlanningCli = cfg.phases.planning.cli;
			currentPlanningModel = cfg.phases.planning.model;
			currentImplCli = cfg.phases.implementation.cli;
			currentImplModel = cfg.phases.implementation.model;
			currentReviewCli = cfg.phases.review.cli;
			currentReviewModel = cfg.phases.review.model;
		}
		console.log(
			pc.dim(
				`Found existing config at ${getGlobalConfigPath()}. Press Enter to keep current values.\n`
			)
		);
	}

	await withSignal(async (signal) => {
		console.log(pc.bold('── Jira ──'));
		const jiraSite = await input(
			{
				message: 'Jira site (e.g. mycompany.atlassian.net):',
				default: currentJiraSite || 'yourcompany.atlassian.net',
			},
			{ signal }
		);
		const jiraProject = await input(
			{
				message: 'Default project key (e.g. KD):',
				default: currentProject || 'KD',
			},
			{ signal }
		);
		let jiraEmail = await input(
			{
				message: 'Jira account email (for API token auth):',
				default: currentJiraEmail,
			},
			{ signal }
		);
		let jiraToken = await password(
			{
				message: 'Jira API token (leave blank to keep existing or use mock):',
				mask: true,
			},
			{ signal }
		);
		if (!jiraToken) jiraToken = currentJiraToken;

		if (jiraEmail && jiraToken) {
			const spinner = ora('Testing Jira connection...').start();
			const testResult = await testJiraConnection(jiraSite, jiraEmail, jiraToken, signal);
			if (testResult.ok) {
				spinner.succeed('Jira connection successful!');
			} else {
				spinner.fail(`Connection failed: ${testResult.error.message}`);
				const action = await select(
					{
						message: 'What would you like to do?',
						choices: [
							{ name: 'Retry with different credentials', value: 'retry' },
							{ name: 'Skip (mock adapter will be used)', value: 'skip' },
						],
					},
					{ signal }
				);
				if (action === 'retry') {
					const newEmail = await input(
						{
							message: 'Jira account email:',
							default: jiraEmail,
						},
						{ signal }
					);
					const newToken = await password(
						{
							message: 'Jira API token:',
							mask: true,
						},
						{ signal }
					);
					if (newEmail && newToken) {
						const retryResult = await testJiraConnection(jiraSite, newEmail, newToken, signal);
						if (retryResult.ok) {
							console.log(pc.green('✓ Connection successful!'));
							jiraEmail = newEmail;
							jiraToken = newToken;
						} else {
							console.log(pc.yellow(`⚠ Still failing: ${retryResult.error.message}`));
							console.log(pc.dim('Continuing with mock adapter. Run "bode setup" to reconfigure.'));
							jiraToken = '';
						}
					}
				} else {
					jiraToken = '';
				}
			}
		}

		console.log(pc.bold('\n── VCS ──'));
		const vcsProvider = await select(
			{
				message: 'VCS provider:',
				default: 'github',
				choices: [
					{
						name: 'GitHub (gh)',
						value: 'github' as const,
						description: 'Uses gh CLI for PR creation',
					},
					{
						name: 'GitLab (glab)',
						value: 'gitlab' as const,
						description: 'Uses glab CLI for MR creation',
					},
				],
			},
			{ signal }
		);
		const githubOrg = await input(
			{
				message: 'Default org:',
				default: currentGithubOrg || 'myorg',
			},
			{ signal }
		);

		const results: unknown[] = [];
		const phaseSteps: WizardStep[] = [
			async () => {
				console.log(pc.bold('\n── Planning Phase ──'));
				return selectCli('CLI for planning:', currentPlanningCli, signal);
			},
			async () => {
				const cli = results[0];
				if (cli === BACK || cli === undefined) return BACK;
				return selectModel(cli as string, currentPlanningModel, signal);
			},
			async () =>
				input(
					{
						message: 'Timeout (minutes):',
						default: '15',
					},
					{ signal }
				),
			async () => {
				console.log(pc.bold('\n── Implementation Phase ──'));
				return selectCli('CLI for implementation:', currentImplCli, signal);
			},
			async () => {
				const cli = results[3];
				if (cli === BACK || cli === undefined) return BACK;
				return selectModel(cli as string, currentImplModel, signal);
			},
			async () =>
				input(
					{
						message: 'Timeout (minutes):',
						default: '60',
					},
					{ signal }
				),
			async () => {
				console.log(pc.bold('\n── Review Phase ──'));
				return selectCli('CLI for review:', currentReviewCli, signal);
			},
			async () => {
				const cli = results[6];
				if (cli === BACK || cli === undefined) return BACK;
				return selectModel(cli as string, currentReviewModel, signal);
			},
			async () =>
				input(
					{
						message: 'Timeout (minutes):',
						default: '10',
					},
					{ signal }
				),
		];

		await runWizard(phaseSteps, results);

		const configYaml = `jira:
  site: ${jiraSite || currentJiraSite}
  default_project: ${jiraProject || currentProject}${jiraEmail ? `\n  email: ${jiraEmail}` : ''}${jiraToken ? `\n  api_token: ${jiraToken}` : ''}

vcs:
  provider: ${vcsProvider}

github:
  default_org: ${githubOrg}

phases:
  planning:
    cli: ${results[0] ?? currentPlanningCli}
    model: ${results[1] ?? currentPlanningModel}
    timeout_minutes: ${parseInt((results[2] as string) || '', 10) || 15}

  implementation:
    cli: ${results[3] ?? currentImplCli}
    model: ${results[4] ?? currentImplModel}
    timeout_minutes: ${parseInt((results[5] as string) || '', 10) || 60}

  review:
    cli: ${results[6] ?? currentReviewCli}
    model: ${results[7] ?? currentReviewModel}
    timeout_minutes: ${parseInt((results[8] as string) || '', 10) || 10}

gates:
  after_planning: true
  after_implementation: true

jira_labels:
  planning: bode:planning
  planned: bode:planned
  implementing: bode:implementing
  reviewing: bode:reviewing
  reviewed: bode:reviewed
  autopilot: bode:autopilot

comment_format:
  plan_inline_max_chars: 3000
  use_emoji: true
`;

		await writeText(getGlobalConfigPath(), configYaml);
		await chmodSensitive(getGlobalConfigPath());

		console.log(pc.green(`\n✓ Config saved to ${getGlobalConfigPath()}`));
		if (jiraToken) {
			console.log(
				pc.dim(
					process.platform === 'win32'
						? '  (Windows: ensure your user profile is not world-readable; consider DPAPI-encrypted storage.)'
						: '  (Permissions tightened to 0600.)'
				)
			);
		}
		console.log(pc.green('✓ Setup complete!\n'));
		console.log(
			pc.dim('Next: Run "bode setup project" to configure a project, then "bode start <TASK-KEY>".')
		);
	});
}

async function setupProjectAction(): Promise<void> {
	console.log(pc.bold(pc.cyan('Bode Project Setup\n')));

	await withSignal(async (signal) => {
		const projectsResult = await listProjects();
		const existingProjects = projectsResult.ok ? projectsResult.value : [];

		let selectedName: string;
		let existingProject: ProjectConfig | null = null;

		if (existingProjects.length > 0) {
			type ProjectChoice = { name: string; value: string | typeof BACK };
			const projectChoices: ProjectChoice[] = existingProjects.map((p) => ({
				name: `${p.name}  ${pc.dim(`(${p.workdir})`)}`,
				value: p.name,
			}));
			projectChoices.push({ name: pc.green('+ Create new project'), value: '__new__' });

			const picked = await select(
				{
					message: 'Select project or create new:',
					choices: projectChoices,
					pageSize: 10,
				},
				{ signal }
			);

			if (typeof picked === 'string' && picked !== '__new__') {
				selectedName = picked;
				const loadResult = await loadProjectConfig(selectedName);
				if (loadResult.ok && loadResult.value) {
					existingProject = loadResult.value;
				}
			} else {
				selectedName = await input(
					{
						message: 'Project name (lowercase, no spaces):',
						validate: (v: string) =>
							/^[a-z0-9][a-z0-9_-]*$/.test(v) ||
							'Use lowercase letters, numbers, dashes, underscores',
					},
					{ signal }
				);
			}
		} else {
			selectedName = await input(
				{
					message: 'Project name (lowercase, no spaces):',
					validate: (v: string) =>
						/^[a-z0-9][a-z0-9_-]*$/.test(v) ||
						'Use lowercase letters, numbers, dashes, underscores',
				},
				{ signal }
			);
		}

		const configResult = await loadConfig();
		const baseJiraSite = configResult.ok ? configResult.value.jira.site : '';
		const baseJiraProject = configResult.ok ? configResult.value.jira.default_project : '';
		const baseVcsProvider = configResult.ok
			? (configResult.value.vcs?.provider ?? 'github')
			: 'github';

		const basePlanningCli = configResult.ok
			? configResult.value.phases.planning.cli
			: 'claude-code';
		const basePlanningModel = configResult.ok
			? configResult.value.phases.planning.model
			: 'claude-opus-4-7';
		const baseImplCli = configResult.ok ? configResult.value.phases.implementation.cli : 'opencode';
		const baseImplModel = configResult.ok
			? configResult.value.phases.implementation.model
			: 'claude-sonnet-4-6';
		const baseReviewCli = configResult.ok ? configResult.value.phases.review.cli : 'opencode';
		const baseReviewModel = configResult.ok
			? configResult.value.phases.review.model
			: 'claude-sonnet-4-6';

		const defaultWorkdir = existingProject?.workdir ?? '';
		const defaultBranch = existingProject?.default_branch ?? 'main';
		const defaultVcsProvider = existingProject?.vcs_provider ?? baseVcsProvider;
		const defaultJiraSite = existingProject?.jira?.site ?? baseJiraSite;
		const defaultJiraProject = existingProject?.jira?.default_project ?? baseJiraProject;
		const defaultContextPaths = existingProject?.context_paths?.join(', ') ?? '.';
		const defaultContextFiles = existingProject?.context_files?.join(', ') ?? 'AGENTS.md,CLAUDE.md';

		const results: unknown[] = [];
		const steps: WizardStep[] = [
			async () => {
				const wd = await input(
					{
						message: 'Working directory (absolute path):',
						default: defaultWorkdir,
					},
					{ signal }
				);

				const workdirPath = wd || defaultWorkdir;
				if (!workdirPath) {
					console.error(pc.red('Working directory is required.'));
					process.exit(1);
				}
				if (!existsSync(workdirPath)) {
					console.error(pc.red(`Directory does not exist: ${workdirPath}`));
					process.exit(1);
				}

				return workdirPath;
			},
			async () => {
				console.log(pc.bold('\n── VCS ──'));
				const vcsChoices: {
					name: string;
					value: 'github' | 'gitlab' | typeof BACK;
					description?: string;
				}[] = [
					{ name: 'GitHub (gh)', value: 'github', description: 'Uses gh CLI for PR creation' },
					{ name: 'GitLab (glab)', value: 'gitlab', description: 'Uses glab CLI for MR creation' },
					{ name: pc.dim('← Back'), value: BACK, description: 'Go back' },
				];
				return select(
					{
						message: 'VCS provider:',
						default: defaultVcsProvider as 'github' | 'gitlab',
						choices: vcsChoices,
					},
					{ signal }
				);
			},
			async () => {
				console.log(pc.bold('\n── Jira (per-project override, Enter to use global) ──'));
				const jiraSite = await input(
					{
						message: 'Jira site:',
						default: defaultJiraSite,
					},
					{ signal }
				);
				const jiraProject = await input(
					{
						message: 'Jira project key:',
						default: defaultJiraProject,
					},
					{ signal }
				);
				return { site: jiraSite, project: jiraProject } as const;
			},
			async () => {
				console.log(pc.bold('\n── Context ──'));
				const branch = await input(
					{
						message: 'Default branch:',
						default: defaultBranch,
					},
					{ signal }
				);
				const pathsRaw = await input(
					{
						message: 'Context paths (comma-separated, relative to workdir):',
						default: defaultContextPaths,
					},
					{ signal }
				);
				const filesRaw = await input(
					{
						message: 'Context files (comma-separated, relative to workdir):',
						default: defaultContextFiles,
					},
					{ signal }
				);
				return { branch, paths: pathsRaw, files: filesRaw } as const;
			},
			async () => {
				console.log(pc.bold('\n── Additional Repositories ──'));
				return input(
					{
						message: 'Number of additional repos (0-10):',
						default: '0',
						validate: (v: string) => {
							const n = parseInt(v, 10);
							if (isNaN(n) || n < 0 || n > 10) return 'Enter a number between 0 and 10';
							return true;
						},
					},
					{ signal }
				);
			},
			async () => {
				const repoCount = parseInt((results[4] as string) || '0', 10);
				if (repoCount === 0) return [];
				const repos: { workdir: string; name?: string }[] = [];
				for (let i = 0; i < repoCount; i++) {
					const wd = await input(
						{
							message: `Repo ${i + 1} workdir path (absolute or relative to project root):`,
						},
						{ signal }
					);
					const name = await input(
						{
							message: `Repo ${i + 1} friendly name (optional):`,
							default: wd.split(/[\\/]/).pop() ?? '',
						},
						{ signal }
					);
					const entry: { workdir: string; name?: string } = { workdir: wd };
					if (name) entry.name = name;
					repos.push(entry);
				}
				return repos;
			},
			async () => {
				console.log(pc.bold('\n── Branch Tool ──'));
				return input(
					{
						message: 'Tool for AI to create branches (e.g. git):',
						default: 'git',
					},
					{ signal }
				);
			},
		];

		const phaseSteps: WizardStep[] = [
			async () => {
				console.log(pc.bold('\n── Planning Phase (override) ──'));
				return selectCli('CLI:', basePlanningCli, signal);
			},
			async () => {
				const cli = results[7];
				if (cli === BACK || cli === undefined) return BACK;
				return selectModel(cli as string, basePlanningModel, signal);
			},
			async () => {
				console.log(pc.bold('\n── Implementation Phase (override) ──'));
				return selectCli('CLI:', baseImplCli, signal);
			},
			async () => {
				const cli = results[9];
				if (cli === BACK || cli === undefined) return BACK;
				return selectModel(cli as string, baseImplModel, signal);
			},
			async () => {
				console.log(pc.bold('\n── Review Phase (override) ──'));
				return selectCli('CLI:', baseReviewCli, signal);
			},
			async () => {
				const cli = results[11];
				if (cli === BACK || cli === undefined) return BACK;
				return selectModel(cli as string, baseReviewModel, signal);
			},
		];

		steps.push(...phaseSteps);

		await runWizard(steps, results);

		const workdir = results[0] as string;
		const vcsProvider = results[1] as 'github' | 'gitlab' | undefined;
		const jiraOverrides = results[2] as { site: string; project: string } | undefined;
		const contextData = results[3] as { branch: string; paths: string; files: string } | undefined;
		const repos = results[5] as { workdir: string; name?: string }[] | undefined;
		const branchTool = results[6] as string | undefined;

		const contextPaths =
			contextData?.paths
				?.split(',')
				.map((s: string) => s.trim())
				.filter(Boolean) ?? [];
		const contextFiles =
			contextData?.files
				?.split(',')
				.map((s: string) => s.trim())
				.filter(Boolean) ?? [];

		const planningCli = results[7] as string | undefined;
		const planningModel = results[8] as string | undefined;
		const implCli = results[9] as string | undefined;
		const implModel = results[10] as string | undefined;
		const reviewCli = results[11] as string | undefined;
		const reviewModel = results[12] as string | undefined;

		const phases: ProjectConfig['phases'] = {};
		let hasPhaseOverride = false;

		if (planningCli && planningCli !== basePlanningCli) {
			phases.planning = { ...phases.planning, cli: planningCli };
			hasPhaseOverride = true;
		}
		if (planningModel && planningModel !== basePlanningModel) {
			phases.planning = { ...phases.planning, model: planningModel };
			hasPhaseOverride = true;
		}
		if (implCli && implCli !== baseImplCli) {
			phases.implementation = { ...phases.implementation, cli: implCli };
			hasPhaseOverride = true;
		}
		if (implModel && implModel !== baseImplModel) {
			phases.implementation = { ...phases.implementation, model: implModel };
			hasPhaseOverride = true;
		}
		if (reviewCli && reviewCli !== baseReviewCli) {
			phases.review = { ...phases.review, cli: reviewCli };
			hasPhaseOverride = true;
		}
		if (reviewModel && reviewModel !== baseReviewModel) {
			phases.review = { ...phases.review, model: reviewModel };
			hasPhaseOverride = true;
		}

		const project: ProjectConfig = {
			name: selectedName,
			workdir,
			default_branch: contextData?.branch || 'main',
			vcs_provider: vcsProvider === 'github' ? undefined : vcsProvider,
			jira: {
				site: jiraOverrides?.site || undefined,
				default_project: jiraOverrides?.project || undefined,
			},
			context_paths: contextPaths.length > 0 ? contextPaths : undefined,
			context_files: contextFiles.length > 0 ? contextFiles : undefined,
			...(hasPhaseOverride ? { phases } : {}),
			...(repos && repos.length > 0 ? { repos } : {}),
			...(branchTool && branchTool !== 'git' ? { branch_tool: branchTool } : {}),
		};

		const saveResult = await saveProjectConfig(project);
		if (!saveResult.ok) {
			console.error(pc.red(`Failed to save project: ${saveResult.error.message}`));
			process.exit(1);
		}

		if (existingProject) {
			console.log(
				pc.green(`\n✓ Project "${selectedName}" updated in ~/.bode/projects/${selectedName}.yml`)
			);
		} else {
			console.log(
				pc.green(`\n✓ Project "${selectedName}" saved to ~/.bode/projects/${selectedName}.yml`)
			);
		}
		console.log(
			pc.dim(`Now run "bode start <TASK-KEY> --project ${selectedName}" to use this project.`)
		);
	});
}
