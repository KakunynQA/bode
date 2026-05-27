import { select } from '@inquirer/prompts';
import pc from 'picocolors';
import type { BodeConfig } from '~/config/schema.ts';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { handlePromptError } from '~/utils/prompt.ts';

export type DangerousPlan = {
	approved: boolean;
	unsupported: string[];
};

/**
 * When the user passes --dangerously-approve-all, this helper checks every
 * phase's configured CLI. For phases whose adapter has a bypass flag, the
 * flag is wired in automatically (handled downstream). For phases whose
 * adapter does NOT support a bypass flag (e.g. opencode), bode warns the
 * user upfront and asks whether to proceed — they'll have to approve
 * actions interactively during those phases.
 *
 * Also prints the global "danger" notice.
 */
export async function planDangerousMode(config: BodeConfig): Promise<DangerousPlan> {
	console.log('');
	console.log(
		pc.yellow('⚠ --dangerously-approve-all: bode will pass each AI CLI its bypass-approvals flag.')
	);
	console.log(pc.yellow('  This disables sandbox prompts. Use only on code you trust.'));
	console.log('');

	const phaseCliNames = Array.from(
		new Set([
			config.phases.planning.cli,
			config.phases.implementation.cli,
			config.phases.review.cli,
		])
	);

	const unsupported: string[] = [];
	for (const cliName of phaseCliNames) {
		const adapter = getAdapter(cliName);
		if (!adapter.ok) continue;
		if (adapter.value.dangerousFlags() === null) {
			unsupported.push(cliName);
		}
	}

	if (unsupported.length > 0) {
		console.log(
			pc.yellow(
				`The following configured CLI(s) do NOT support an auto-bypass flag: ${unsupported.join(', ')}.`
			)
		);
		console.log(
			pc.dim(
				'  During those phases you will need to approve actions interactively in the terminal.'
			)
		);
		console.log('');

		try {
			const choice = await select({
				message: 'Proceed anyway?',
				choices: [
					{ name: 'Yes — I will approve interactively when prompted', value: 'yes' },
					{ name: 'No — abort and let me reconfigure those phases', value: 'no' },
				],
			});
			if (choice !== 'yes') {
				return { approved: false, unsupported };
			}
		} catch (err) {
			handlePromptError(err);
			return { approved: false, unsupported };
		}
	}

	return { approved: true, unsupported };
}
