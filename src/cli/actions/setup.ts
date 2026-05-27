import pc from 'picocolors';
import { getGlobalDir, getGlobalConfigPath } from '~/config/defaults.ts';
import { existsSync } from 'node:fs';
import { ensureDir, writeText } from '~/utils/fs.ts';
import { loadConfig } from '~/config/loader.ts';
import { listAdapterNames } from '~/adapters/cli/registry.ts';

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    process.stdin.once('data', (data: string) => {
      process.stdin.pause();
      resolve(data.trim());
    });
  });
}

function promptDefault(question: string, defaultValue: string): Promise<string> {
  return prompt(`${question} ${pc.dim(`(${defaultValue})`)}: `);
}

async function selectFromList(question: string, options: string[], defaultOption: string): Promise<string> {
  console.log(`\n${question}`);
  for (let i = 0; i < options.length; i++) {
    const marker = options[i] === defaultOption ? pc.green(' ← default') : '';
    console.log(`  ${pc.bold(String(i + 1))}. ${options[i]}${marker}`);
  }
  const answer = await prompt('Choose (number or name): ');
  if (!answer) return defaultOption;
  const num = parseInt(answer, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return options[num - 1] ?? defaultOption;
  }
  if (options.includes(answer)) return answer;
  return defaultOption;
}

export async function setupAction(): Promise<void> {
  console.log(pc.bold('\n🐐 Bode Setup Wizard\n'));

  const globalDir = getGlobalDir();
  await ensureDir(globalDir);
  await ensureDir(`${globalDir}/runs`);
  await ensureDir(`${globalDir}/skills`);
  console.log(pc.green(`✓ Created ${globalDir}\n`));

  const adapters = listAdapterNames();
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

  // --- Jira ---
  console.log(pc.bold('── Jira ──'));
  const jiraSite = await promptDefault('Jira site (e.g. mycompany.atlassian.net)', currentJiraSite || 'yourcompany.atlassian.net');
  const jiraProject = await promptDefault('Default project key (e.g. KD)', currentProject || 'KD');

  // --- GitHub ---
  console.log(pc.bold('\n── GitHub ──'));
  const githubOrg = await promptDefault('Default GitHub org', currentGithubOrg || 'myorg');

  // --- Planning Phase ---
  console.log(pc.bold('\n── Planning Phase ──'));
  const planningCli = await selectFromList('CLI for planning:', adapters, currentPlanningCli);
  const planningModel = await promptDefault('Model', currentPlanningModel);
  const planningTimeout = await promptDefault('Timeout (minutes)', '15');

  // --- Implementation Phase ---
  console.log(pc.bold('\n── Implementation Phase ──'));
  const implCli = await selectFromList('CLI for implementation:', adapters, currentImplCli);
  const implModel = await promptDefault('Model', currentImplModel);
  const implTimeout = await promptDefault('Timeout (minutes)', '60');

  // --- Review Phase ---
  console.log(pc.bold('\n── Review Phase ──'));
  const reviewCli = await selectFromList('CLI for review:', adapters, currentReviewCli);
  const reviewModel = await promptDefault('Model', currentReviewModel);
  const reviewTimeout = await promptDefault('Timeout (minutes)', '10');

  // --- Build config YAML ---
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
