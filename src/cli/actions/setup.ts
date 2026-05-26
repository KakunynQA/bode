import pc from 'picocolors';
import { getGlobalDir, getGlobalConfigPath } from '~/config/defaults.ts';
import { existsSync } from 'node:fs';
import { ensureDir, writeText } from '~/utils/fs.ts';

export async function setupAction(): Promise<void> {
  console.log(pc.bold('Bode Setup\n'));

  const globalDir = getGlobalDir();
  await ensureDir(globalDir);
  await ensureDir(`${globalDir}/runs`);
  await ensureDir(`${globalDir}/skills`);

  console.log(pc.green(`Created ${globalDir}`));

  if (!existsSync(getGlobalConfigPath())) {
    const defaultConfig = `jira:
  site: ""
  default_project: ""

phases:
  planning:
    cli: claude-code
    model: claude-opus-4-7
    timeout_minutes: 15

  implementation:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 60

  review:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 10
`;
    await writeText(getGlobalConfigPath(), defaultConfig);
    console.log(pc.green(`Created default config at ${getGlobalConfigPath()}`));
    console.log(pc.dim('Edit it with your Jira site and project key.'));
  } else {
    console.log(pc.dim(`Config already exists at ${getGlobalConfigPath()}`));
  }

  console.log(pc.green('\nSetup complete!'));
  console.log(pc.dim('Next: Edit ~/.bode/config.yml with your Jira credentials, then run "bode start <KEY>"'));
}
