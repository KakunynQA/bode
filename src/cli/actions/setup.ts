import pc from 'picocolors';
import ora from 'ora';
import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { getGlobalDir, getGlobalConfigPath } from '~/config/defaults.ts';
import { ensureDir, writeText, chmodSensitive } from '~/utils/fs.ts';
import { loadConfig } from '~/config/loader.ts';
import { listAdapterNames } from '~/adapters/cli/registry.ts';
import { getModelsForCli } from '~/adapters/cli/models.ts';
import { listProjects, loadProjectConfig } from '~/config/projects.ts';
import { saveProjectConfig } from '~/config/project-resolver.ts';
import { detectContextFilesIn } from '~/config/auto-detect.ts';
import { scanWorkdirFiles } from '~/utils/file-picker.ts';
import type { ProjectConfig } from '~/config/schema.ts';
import {
	askInput,
	askInputWithAtTrigger,
	askSelect,
	askPassword,
	askSearch,
	handlePromptError,
	AT_TRIGGER,
	PICKER_DISMISSED,
} from '~/utils/prompt.ts';
import { testJiraConnection } from '~/adapters/jira/rest.ts';
import { getVersion } from '~/utils/version.ts';
import {
	investigateProjectContext,
	resolveProjectContextPath,
} from './setup-project-investigate.ts';

type WizardStep<T = unknown> = () => Promise<T>;

async function runWizard(steps: WizardStep[], results: unknown[]): Promise<void> {
	for (let cursor = 0; cursor < steps.length; cursor++) {
		const step = steps[cursor]!;
		results[cursor] = await step();
	}
}

async function selectCli(question: string, defaultCli: string): Promise<string> {
	const adapters = listAdapterNames();
	const choices = adapters.map((name) => ({
		name,
		value: name,
		description: cliDescription(name),
	}));
	return askSelect<string>({
		message: question,
		default: defaultCli,
		choices,
	});
}

async function selectModel(cliName: string, currentModel: string): Promise<string> {
	const models = getModelsForCli(cliName);
	if (models.length === 0) {
		return askInput({ message: 'Model:', default: currentModel });
	}
	const choices: { name: string; value: string }[] = models.map((m) => ({ name: m, value: m }));
	choices.push({ name: pc.dim('(other — type manually)'), value: '__custom__' });
	const chosen = await askSelect<string>({
		message: 'Model:',
		default: currentModel,
		choices,
	});
	if (chosen === '__custom__') {
		return askInput({ message: 'Custom model name:', default: currentModel });
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
		default:
			return '';
	}
}

/**
 * Pins the workdir-normalisation contract for the `@` picker. Exposed via
 * `__testing` for a regression test that asserts a relative path becomes
 * absolute before any picker call, so the picker can't silently scan the
 * launching shell's cwd (root cause of the v2.0.4 "@ scans bode's own
 * folder" report).
 */
function resolveWorkdirForPicker(workdir: string): string {
	return resolvePath(workdir);
}

/**
 * Asks for a comma-separated list of context files with `@` triggering a
 * fuzzy file picker. Auto-detected defaults are pre-filled.
 *
 * `workdir` is normalised to an absolute path before any picker call so a
 * relative or `.` workdir cannot leak the cwd of the launching shell into
 * the picker (which would scan bode's own project folder when the TUI
 * shell was launched from there).
 */
async function askContextFiles(
	workdir: string,
	defaults: string[],
	message: string
): Promise<string[]> {
	const absWorkdir = resolveWorkdirForPicker(workdir);
	let selected = uniqueStrings(defaults);
	const hint = pc.dim('Type @ to open file picker. Comma-separated for multiple files.');
	console.log(pc.dim(`  Scanning ${pc.cyan(absWorkdir)} for candidate files`));
	while (true) {
		console.log(`  ${hint}`);
		const raw = await askInputWithAtTrigger({
			message,
			default: selected.join(', '),
		});
		if (raw === AT_TRIGGER) {
			const picked = await pickContextFile(absWorkdir, 'Pick a context file:');
			if (picked !== null) selected = uniqueStrings([...selected, picked]);
			continue;
		}

		const entries = raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		const expanded: string[] = [];
		for (const entry of entries) {
			if (entry.startsWith('@')) {
				const picked = await pickContextFile(absWorkdir, 'Pick a context file:', entry.slice(1));
				if (picked !== null) expanded.push(picked);
			} else {
				expanded.push(entry);
			}
		}
		return uniqueStrings(expanded);
	}
}

async function pickContextFile(
	workdir: string,
	message: string,
	initialQuery = ''
): Promise<string | null> {
	const result = await askSearch<string>({
		message,
		source: async (input) => {
			const files = await scanWorkdirFiles(workdir, input ?? initialQuery);
			return files.map((f) => ({ name: f, value: f }));
		},
	});
	if (result === PICKER_DISMISSED) return null;
	return result;
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export const __testing = { resolveWorkdirForPicker, uniqueStrings };

export async function setupAction(
	subcommand?: string,
	options?: { sharedInRepo?: boolean; refreshContext?: boolean }
): Promise<void> {
	if (subcommand === 'project') {
		await setupProjectAction(options ?? {});
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
			currentJiraSite = cfg.jira.site ?? '';
			currentProject = cfg.jira.default_project ?? '';
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

	try {
		console.log(pc.bold('── Jira ──'));
		const jiraSite = await askInput({
			message: 'Jira site (e.g. mycompany.atlassian.net):',
			default: currentJiraSite || 'yourcompany.atlassian.net',
		});
		const jiraProject = await askInput({
			message: 'Default project key (e.g. KD):',
			default: currentProject || 'KD',
		});
		let jiraEmail = await askInput({
			message: 'Jira account email (for API token auth):',
			default: currentJiraEmail,
		});
		let jiraToken = await askPassword({
			message: 'Jira API token (leave blank to keep existing or use mock):',
			mask: true,
		});
		if (!jiraToken) jiraToken = currentJiraToken;

		if (jiraEmail && jiraToken) {
			const spinner = ora('Testing Jira connection...').start();
			const testResult = await testJiraConnection(jiraSite, jiraEmail, jiraToken);
			if (testResult.ok) {
				spinner.succeed('Jira connection successful!');
			} else {
				spinner.fail(`Connection failed: ${testResult.error.message}`);
				const action = await askSelect<'retry' | 'skip'>({
					message: 'What would you like to do?',
					choices: [
						{ name: 'Retry with different credentials', value: 'retry' },
						{ name: 'Skip (mock adapter will be used)', value: 'skip' },
					],
				});
				if (action === 'retry') {
					const newEmail = await askInput({
						message: 'Jira account email:',
						default: jiraEmail,
					});
					const newToken = await askPassword({
						message: 'Jira API token:',
						mask: true,
					});
					if (newEmail && newToken) {
						const retryResult = await testJiraConnection(jiraSite, newEmail, newToken);
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
		const vcsProvider = await askSelect<'github' | 'gitlab'>({
			message: 'VCS provider:',
			default: 'github',
			choices: [
				{ name: 'GitHub (gh)', value: 'github', description: 'Uses gh CLI for PR creation' },
				{ name: 'GitLab (glab)', value: 'gitlab', description: 'Uses glab CLI for MR creation' },
			],
		});
		const githubOrg = await askInput({
			message: 'Default org:',
			default: currentGithubOrg || 'myorg',
		});

		const results: unknown[] = [];
		const phaseSteps: WizardStep[] = [
			async () => {
				console.log(pc.bold('\n── Planning Phase ──'));
				return selectCli('CLI for planning:', currentPlanningCli);
			},
			async () => selectModel(results[0] as string, currentPlanningModel),
			async () => askInput({ message: 'Timeout (minutes):', default: '15' }),
			async () => {
				console.log(pc.bold('\n── Implementation Phase ──'));
				return selectCli('CLI for implementation:', currentImplCli);
			},
			async () => selectModel(results[3] as string, currentImplModel),
			async () => askInput({ message: 'Timeout (minutes):', default: '60' }),
			async () => {
				console.log(pc.bold('\n── Review Phase ──'));
				return selectCli('CLI for review:', currentReviewCli);
			},
			async () => selectModel(results[6] as string, currentReviewModel),
			async () => askInput({ message: 'Timeout (minutes):', default: '10' }),
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
			pc.dim('Next: Run "bode setup-project" to configure a project, then "bode start <TASK-KEY>".')
		);
	} catch (err) {
		handlePromptError(err);
	}
}

async function setupProjectAction(options: {
	sharedInRepo?: boolean;
	refreshContext?: boolean;
}): Promise<void> {
	console.log(pc.bold(pc.cyan('Bode Project Setup\n')));

	try {
		const projectsResult = await listProjects();
		const existingProjects = projectsResult.ok ? projectsResult.value : [];

		let selectedName: string;
		let existingProject: ProjectConfig | null = null;

		if (existingProjects.length > 0) {
			type ProjectChoice = { name: string; value: string };
			const projectChoices: ProjectChoice[] = existingProjects.map((p) => ({
				name: `${p.name}  ${pc.dim(`(${p.workdir})`)}`,
				value: p.name,
			}));
			projectChoices.push({ name: pc.green('+ Create new project'), value: '__new__' });

			const picked = await askSelect<string>({
				message: 'Select project or create new:',
				choices: projectChoices,
				pageSize: 10,
			});

			if (picked !== '__new__') {
				selectedName = picked;
				const loadResult = await loadProjectConfig(selectedName);
				if (loadResult.ok && loadResult.value) {
					existingProject = loadResult.value;
				}
			} else {
				selectedName = await askInput({
					message: 'Project name (lowercase, no spaces):',
					validate: (v: string) =>
						/^[a-z0-9][a-z0-9_-]*$/.test(v) ||
						'Use lowercase letters, numbers, dashes, underscores',
				});
			}
		} else {
			selectedName = await askInput({
				message: 'Project name (lowercase, no spaces):',
				validate: (v: string) =>
					/^[a-z0-9][a-z0-9_-]*$/.test(v) || 'Use lowercase letters, numbers, dashes, underscores',
			});
		}

		if (existingProject?.context_paths?.length) {
			console.log(
				pc.dim(
					'  ⚠ context_paths is deprecated and will be dropped on save. Use context_files instead.\n'
				)
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
		const basePlanningTimeout = configResult.ok
			? configResult.value.phases.planning.timeout_minutes
			: 15;
		const baseImplCli = configResult.ok ? configResult.value.phases.implementation.cli : 'opencode';
		const baseImplModel = configResult.ok
			? configResult.value.phases.implementation.model
			: 'claude-sonnet-4-6';
		const baseReviewCli = configResult.ok ? configResult.value.phases.review.cli : 'opencode';
		const baseReviewModel = configResult.ok
			? configResult.value.phases.review.model
			: 'claude-sonnet-4-6';

		// --- Refresh-context short-circuit -----------------------------------
		if (options.refreshContext) {
			if (!existingProject) {
				console.error(
					pc.red(
						'--refresh-context requires an existing project. Run without the flag to create one.'
					)
				);
				process.exit(1);
			}
			const cliName = existingProject.phases?.planning?.cli ?? basePlanningCli;
			const model = existingProject.phases?.planning?.model ?? basePlanningModel;
			const timeout = existingProject.phases?.planning?.timeout_minutes ?? basePlanningTimeout;
			const result = await investigateProjectContext({
				workdir: existingProject.workdir,
				projectName: selectedName,
				sharedInRepo: options.sharedInRepo ?? false,
				cliName,
				model,
				timeoutMinutes: timeout,
			});
			const updated: ProjectConfig = {
				...existingProject,
				project_context_path: result.path,
				context_investigated_at: result.investigatedAt,
			};
			const saveResult = await saveProjectConfig(updated);
			if (!saveResult.ok) {
				console.error(pc.red(`Failed to save project: ${saveResult.error.message}`));
				process.exit(1);
			}
			console.log(pc.green(`\n✓ Project "${selectedName}" context refreshed.`));
			return;
		}

		// --- Full wizard flow -------------------------------------------------
		const defaultWorkdir = existingProject?.workdir ?? '';
		const defaultBranch = existingProject?.default_branch ?? 'main';
		const defaultVcsProvider = existingProject?.vcs_provider ?? baseVcsProvider;
		const defaultJiraSite = existingProject?.jira?.site ?? baseJiraSite;
		const defaultJiraProject = existingProject?.jira?.default_project ?? baseJiraProject;

		const results: unknown[] = [];
		const steps: WizardStep[] = [
			async () => {
				const wd = await askInput({
					message: 'Working directory (absolute path):',
					default: defaultWorkdir,
				});
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
				console.log(pc.bold('\n── Investigate Project Context ──'));
				return askSelect<'yes' | 'no'>({
					message: 'Investigate & document project context now?',
					default: existingProject ? 'no' : 'yes',
					choices: [
						{
							name: 'Yes — run AI to summarize the project (writes PROJECT_CONTEXT.md)',
							value: 'yes',
						},
						{
							name: 'No — skip (you can run later with --refresh-context)',
							value: 'no',
						},
					],
				});
			},
			async () => {
				const wantInvestigate = results[1];
				if (wantInvestigate !== 'yes') return undefined;
				console.log(pc.bold('\n── Investigation Model ──'));
				const cli = await selectCli('CLI for investigation:', basePlanningCli);
				const model = await selectModel(cli, basePlanningModel);
				return { cli, model };
			},
			async () => {
				console.log(pc.bold('\n── VCS ──'));
				return askSelect<'github' | 'gitlab'>({
					message: 'VCS provider:',
					default: defaultVcsProvider as 'github' | 'gitlab',
					choices: [
						{ name: 'GitHub (gh)', value: 'github' },
						{ name: 'GitLab (glab)', value: 'gitlab' },
					],
				});
			},
			async () => {
				console.log(pc.bold('\n── Jira (per-project override, Enter to use global) ──'));
				const jiraSite = await askInput({
					message: 'Jira site:',
					default: defaultJiraSite,
				});
				const jiraProject = await askInput({
					message: 'Jira project key:',
					default: defaultJiraProject,
				});
				return { site: jiraSite, project: jiraProject } as const;
			},
			async () => {
				console.log(pc.bold('\n── Context ──'));
				const branch = await askInput({
					message: 'Default branch:',
					default: defaultBranch,
				});
				const workdir = results[0] as string;
				const detected = detectContextFilesIn(workdir);
				const defaults =
					existingProject?.context_files ?? (detected.length > 0 ? detected : ['AGENTS.md']);
				const files = await askContextFiles(
					workdir,
					defaults,
					'Context files (comma-separated, or @ to pick):'
				);
				return { branch, files } as const;
			},
			async () => {
				console.log(pc.bold('\n── Additional Repositories ──'));
				return askInput({
					message: 'Number of additional repos (0-10):',
					default: '0',
					validate: (v: string) => {
						const n = parseInt(v, 10);
						if (isNaN(n) || n < 0 || n > 10) return 'Enter a number between 0 and 10';
						return true;
					},
				});
			},
			async () => {
				const repoCount = parseInt((results[6] as string) || '0', 10);
				if (repoCount === 0) return [];
				const repos: { workdir: string; name?: string; context_files?: string[] }[] = [];
				for (let i = 0; i < repoCount; i++) {
					const wd = await askInput({
						message: `Repo ${i + 1} workdir path:`,
					});
					const name = await askInput({
						message: `Repo ${i + 1} friendly name (optional):`,
						default: wd.split(/[\\/]/).pop() ?? '',
					});
					const detected = existsSync(wd) ? detectContextFilesIn(wd) : [];
					const files = await askContextFiles(
						wd,
						detected,
						`Context files for ${name || `repo ${i + 1}`} (comma-separated, or @ to pick):`
					);
					const entry: { workdir: string; name?: string; context_files?: string[] } = {
						workdir: wd,
					};
					if (name) entry.name = name;
					if (files.length > 0) entry.context_files = files;
					repos.push(entry);
				}
				return repos;
			},
			async () => {
				console.log(pc.bold('\n── Branch Tool ──'));
				return askInput({
					message: 'Tool for AI to create branches (e.g. git):',
					default: 'git',
				});
			},
		];

		const phaseSteps: WizardStep[] = [
			async () => {
				console.log(pc.bold('\n── Planning Phase (override) ──'));
				return selectCli('CLI:', basePlanningCli);
			},
			async () => selectModel(results[9] as string, basePlanningModel),
			async () => {
				console.log(pc.bold('\n── Implementation Phase (override) ──'));
				return selectCli('CLI:', baseImplCli);
			},
			async () => selectModel(results[11] as string, baseImplModel),
			async () => {
				console.log(pc.bold('\n── Review Phase (override) ──'));
				return selectCli('CLI:', baseReviewCli);
			},
			async () => selectModel(results[13] as string, baseReviewModel),
		];

		steps.push(...phaseSteps);

		await runWizard(steps, results);

		const workdir = results[0] as string;
		const investigationChoice = results[1] as 'yes' | 'no' | undefined;
		const investigationModel = results[2] as { cli: string; model: string } | undefined;
		const vcsProvider = results[3] as 'github' | 'gitlab' | undefined;
		const jiraOverrides = results[4] as { site: string; project: string } | undefined;
		const contextData = results[5] as { branch: string; files: string[] } | undefined;
		const repos = results[7] as
			| { workdir: string; name?: string; context_files?: string[] }[]
			| undefined;
		const branchTool = results[8] as string | undefined;

		const contextFiles = contextData?.files ?? [];

		const planningCli = results[9] as string | undefined;
		const planningModel = results[10] as string | undefined;
		const implCli = results[11] as string | undefined;
		const implModel = results[12] as string | undefined;
		const reviewCli = results[13] as string | undefined;
		const reviewModel = results[14] as string | undefined;

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

		// Investigation runs AFTER the wizard finishes so the user can see all
		// answers before committing to a multi-minute AI run.
		let investigationResult: { path: string; investigatedAt: string } | null = null;
		if (investigationChoice === 'yes' && investigationModel) {
			try {
				investigationResult = await investigateProjectContext({
					workdir,
					projectName: selectedName,
					sharedInRepo: options.sharedInRepo ?? false,
					cliName: investigationModel.cli,
					model: investigationModel.model,
					timeoutMinutes: basePlanningTimeout,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(pc.yellow(`⚠ Investigation failed: ${msg}`));
				console.log(
					pc.dim(
						'  The project will be saved without project_context_path. Retry with --refresh-context.'
					)
				);
			}
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
			context_files: contextFiles.length > 0 ? contextFiles : undefined,
			...(investigationResult
				? {
						project_context_path: investigationResult.path,
						context_investigated_at: investigationResult.investigatedAt,
					}
				: {}),
			...(hasPhaseOverride ? { phases } : {}),
			...(repos && repos.length > 0 ? { repos } : {}),
			...(branchTool && branchTool !== 'git' ? { branch_tool: branchTool } : {}),
		};

		const saveResult = await saveProjectConfig(project);
		if (!saveResult.ok) {
			console.error(pc.red(`Failed to save project: ${saveResult.error.message}`));
			process.exit(1);
		}

		const verb = existingProject ? 'updated' : 'saved';
		console.log(
			pc.green(`\n✓ Project "${selectedName}" ${verb} in ~/.bode/projects/${selectedName}.yml`)
		);
		if (investigationResult) {
			const where = options.sharedInRepo ? '(in repo)' : '(global cache)';
			console.log(pc.dim(`  Project context: ${investigationResult.path} ${where}`));
		} else {
			const previewPath = resolveProjectContextPath(
				selectedName,
				workdir,
				options.sharedInRepo ?? false
			);
			console.log(
				pc.dim(`  Run "bode setup-project --refresh-context --project ${selectedName}" later`)
			);
			console.log(pc.dim(`  to generate ${previewPath}`));
		}
		console.log(
			pc.dim(`Now run "bode start <TASK-KEY> --project ${selectedName}" to use this project.`)
		);
	} catch (err) {
		handlePromptError(err);
	}
}
