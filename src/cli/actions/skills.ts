import { flavorForCli, resolveSkillPath } from '~/skills/resolver.ts';
import { loadConfig } from '~/config/loader.ts';
import pc from 'picocolors';

const PHASES = ['planning', 'plan-review', 'implementation', 'review', 'learn', 'init-agents'];

export async function skillsAction(options: { project?: string }): Promise<void> {
	const configResult = await loadConfig(options.project);
	const config = configResult.ok ? configResult.value : null;
	for (const phase of PHASES) {
		const phaseConfig =
			phase === 'plan-review'
				? config?.phases.plan_review
				: phase === 'planning' || phase === 'implementation' || phase === 'review'
					? config?.phases[phase]
					: config?.phases.planning;
		const opts: { projectRoot: string | undefined; globalDir: string | undefined; cli?: string } = {
			projectRoot: options.project,
			globalDir: undefined,
		};
		if (phaseConfig?.cli) opts.cli = phaseConfig.cli;
		const result = await resolveSkillPath(phase, opts);
		if (result.ok) {
			console.log(
				`${pc.bold(phase)}: ${pc.cyan(result.value)} ${pc.dim(`(${flavorForCli(phaseConfig?.cli)})`)}`
			);
		} else {
			console.log(`${pc.bold(phase)}: ${pc.yellow('not found')}`);
		}
	}
}
