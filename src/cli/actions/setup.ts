import pc from 'picocolors';
import { select, input } from '@inquirer/prompts';
import { getGlobalDir, getGlobalConfigPath } from '~/config/defaults.ts';
import { existsSync } from 'node:fs';
import { ensureDir, writeText } from '~/utils/fs.ts';
import { loadConfig } from '~/config/loader.ts';
import { listAdapterNames } from '~/adapters/cli/registry.ts';
import { getModelsForCli } from '~/adapters/cli/models.ts';

declare const __GOAT_ART__: string;

async function selectCli(question: string, defaultCli: string): Promise<string> {
  const adapters = listAdapterNames();
  return select({
    message: question,
    default: defaultCli,
    choices: adapters.map((name) => ({
      name,
      value: name,
      description: cliDescription(name),
    })),
  });
}

async function selectModel(cliName: string, currentModel: string): Promise<string> {
  const models = getModelsForCli(cliName);
  if (models.length === 0) {
    return input({
      message: 'Model:',
      default: currentModel,
    });
  }

  const choices = models.map((m) => ({
    name: m,
    value: m,
  }));

  choices.push({
    name: pc.dim('(other — type manually)'),
    value: '__custom__',
  });

  const chosen = await select({
    message: 'Model:',
    default: currentModel,
    choices,
  });

  if (chosen === '__custom__') {
    return input({
      message: 'Custom model name:',
      default: currentModel,
    });
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

export async function setupAction(): Promise<void> {
  console.log(__GOAT_ART__);
  console.log(pc.bold(pc.cyan('  Bode Setup Wizard v0.5.0\n')));

  const globalDir = getGlobalDir();
  await ensureDir(globalDir);
  await ensureDir(`${globalDir}/runs`);
  await ensureDir(`${globalDir}/skills`);
  console.log(pc.green(`✓ Created ${globalDir}\n`));

  const existingConfig = existsSync(getGlobalConfigPath());

  let currentJiraSite = '';
  let currentProject = '';
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
      currentGithubOrg = cfg.github?.default_org ?? '';
      currentPlanningCli = cfg.phases.planning.cli;
      currentPlanningModel = cfg.phases.planning.model;
      currentImplCli = cfg.phases.implementation.cli;
      currentImplModel = cfg.phases.implementation.model;
      currentReviewCli = cfg.phases.review.cli;
      currentReviewModel = cfg.phases.review.model;
    }
    console.log(pc.dim(`Found existing config at ${getGlobalConfigPath()}. Press Enter to keep current values.\n`));
  }

  console.log(pc.bold('── Jira ──'));
  const jiraSite = await input({
    message: 'Jira site (e.g. mycompany.atlassian.net):',
    default: currentJiraSite || 'yourcompany.atlassian.net',
  });
  const jiraProject = await input({
    message: 'Default project key (e.g. KD):',
    default: currentProject || 'KD',
  });

  console.log(pc.bold('\n── GitHub ──'));
  const githubOrg = await input({
    message: 'Default GitHub org:',
    default: currentGithubOrg || 'myorg',
  });

  console.log(pc.bold('\n── Planning Phase ──'));
  const planningCli = await selectCli('CLI for planning:', currentPlanningCli);
  const planningModel = await selectModel(planningCli, currentPlanningModel);
  const planningTimeout = await input({
    message: 'Timeout (minutes):',
    default: '15',
  });

  console.log(pc.bold('\n── Implementation Phase ──'));
  const implCli = await selectCli('CLI for implementation:', currentImplCli);
  const implModel = await selectModel(implCli, currentImplModel);
  const implTimeout = await input({
    message: 'Timeout (minutes):',
    default: '60',
  });

  console.log(pc.bold('\n── Review Phase ──'));
  const reviewCli = await selectCli('CLI for review:', currentReviewCli);
  const reviewModel = await selectModel(reviewCli, currentReviewModel);
  const reviewTimeout = await input({
    message: 'Timeout (minutes):',
    default: '10',
  });

  const configYaml = `jira:
  site: ${jiraSite || currentJiraSite}
  default_project: ${jiraProject || currentProject}

github:
  default_org: ${githubOrg}

phases:
  planning:
    cli: ${planningCli}
    model: ${planningModel || currentPlanningModel}
    timeout_minutes: ${parseInt(planningTimeout, 10) || 15}

  implementation:
    cli: ${implCli}
    model: ${implModel || currentImplModel}
    timeout_minutes: ${parseInt(implTimeout, 10) || 60}

  review:
    cli: ${reviewCli}
    model: ${reviewModel || currentReviewModel}
    timeout_minutes: ${parseInt(reviewTimeout, 10) || 10}

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

  console.log(pc.green(`\n✓ Config saved to ${getGlobalConfigPath()}`));
  console.log(pc.green('✓ Setup complete!\n'));
  console.log(pc.dim('Next: Run "bode start <TASK-KEY>" to begin working on a Jira task.'));
}
