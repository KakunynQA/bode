import { askSelect, BACK } from '~/utils/prompt.ts';
import pc from 'picocolors';
import { handlePromptError } from '~/utils/prompt.ts';

export type MissingArtifactDecision = 'retry' | 'continue' | 'abort';

export async function handleMissingArtifact(
	context: string,
	taskKey: string
): Promise<MissingArtifactDecision> {
	console.log('');
	console.log(
		pc.yellow(`⚠ The AI session for ${context} exited without writing the phase artifact.`)
	);
	console.log(
		pc.dim(
			'  The AI may have hit a permission/approval block, ran out of context, or just quit early.'
		)
	);
	console.log(pc.dim('  Inspect the log with: ') + pc.bold(`bode log ${taskKey}`));
	console.log('');

	try {
		const choice = await askSelect<MissingArtifactDecision>({
			message: 'What do you want to do?',
			choices: [
				{
					name: 'Retry — re-run this phase from scratch',
					value: 'retry',
				},
				{
					name: 'Continue — treat as success and advance anyway',
					value: 'continue',
				},
				{
					name: 'Abort — stop here, fix manually, and rerun later',
					value: 'abort',
				},
			],
		});
		if (choice === BACK) return 'abort';
		return choice as MissingArtifactDecision;
	} catch (err) {
		handlePromptError(err);
		return 'abort';
	}
}
