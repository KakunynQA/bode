import { loadRunMeta, saveRunMeta } from '~/storage/run-meta.ts';
import { getRunDir } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';
import pc from 'picocolors';

export async function abortRun(taskKey: string): Promise<Result<void>> {
	const result = await loadRunMeta(taskKey);
	if (!result.ok || !result.value) {
		return { ok: false, error: new Error(`No run found for ${taskKey}`) };
	}

	const meta = result.value;
	await saveRunMeta({ ...meta, status: 'aborted', updatedAt: Date.now() });
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
		process.exit(1);
	}

	const metaR = await loadRunMeta(taskKey);
	const meta = metaR.ok ? metaR.value : null;
	console.log(pc.green(`Task ${taskKey} aborted.`));
	console.log(pc.dim(`Run data preserved at ${getRunDir(taskKey)}`));

	if (meta?.branch) {
		console.log('');
		console.log(
			pc.yellow(
				`Branch ${pc.bold(meta.branch)} may still exist locally and/or on origin. Clean up with:`
			)
		);
		console.log(pc.dim(`  git checkout ${meta.baseBranch ?? 'main'}`));
		console.log(pc.dim(`  git branch -D ${meta.branch}`));
		console.log(pc.dim(`  git push origin --delete ${meta.branch}`));
	}
}
