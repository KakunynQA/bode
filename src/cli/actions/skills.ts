import { resolveSkillPath } from '~/skills/resolver.ts';
import pc from 'picocolors';

const PHASES = ['planning', 'implementation', 'review'];

export async function skillsAction(options: { project?: string }): Promise<void> {
  for (const phase of PHASES) {
    const result = await resolveSkillPath(phase, { projectRoot: options.project, globalDir: undefined });
    if (result.ok) {
      console.log(`${pc.bold(phase)}: ${pc.cyan(result.value)}`);
    } else {
      console.log(`${pc.bold(phase)}: ${pc.yellow('not found')}`);
    }
  }
}
