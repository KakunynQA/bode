import { loadRunMeta, saveRunMeta } from '~/storage/run-meta.ts';
import { getRunDir } from '~/config/defaults.ts';
import { cleanupBranch } from '~/orchestrator/branch-manager.ts';
import type { Result } from '~/types/result.ts';
import pc from 'picocolors';

export async function abortRun(taskKey: string): Promise<Result<void>> {
	const result = await loadRunMeta(taskKey);
	if (!result.ok || !result.value) {
		return { ok: false, error: new Error(`No run found for ${taskKey}`) };
	}

	const meta = result.value;

	if (meta.branch && meta.baseBranch) {
		const workdir = meta.workdir ?? process.cwd();
		const cleanupResult = await cleanupBranch(workdir, meta.branch, meta.baseBranch);
		if (!cleanupResult.ok) {
			return {
				ok: false,
				error: new Error(
					`Could not clean up branch ${meta.branch}: ${cleanupResult.error.message}`
				),
			};
		}
	}

	await saveRunMeta({ ...meta, status: 'aborted' });

	return { ok: true, value: undefined };
}

export async function abortAction(taskKey: string, options: { yes?: boolean }): Promise<void> {
	if (!options.yes) {
		console.log(pc.yellow(`Are you sure you want to abort ${taskKey}? Use --yes to confirm.`));
		return;
	}

	const result = await abortRun(taskKey);
	if (!result.ok) {
		console.error(pc.red(result.error.message));
		console.error(pc.dim('You may need to delete the branch manually.'));
		process.exit(1);
	}

	console.log(pc.green(`Task ${taskKey} aborted.`));
	console.log(pc.dim(`Run data preserved at ${getRunDir(taskKey)}`));
}
