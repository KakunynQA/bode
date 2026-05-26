import { loadRunMeta, saveRunMeta } from '~/storage/run-meta.ts';
import { getRunDir } from '~/config/defaults.ts';
import pc from 'picocolors';

export async function abortAction(taskKey: string, options: { yes?: boolean }): Promise<void> {
  if (!options.yes) {
    console.log(pc.yellow(`Are you sure you want to abort ${taskKey}? Use --yes to confirm.`));
    return;
  }

  const result = await loadRunMeta(taskKey);
  if (!result.ok || !result.value) {
    console.error(pc.red(`No run found for ${taskKey}`));
    process.exit(1);
  }

  const meta = result.value;
  await saveRunMeta({ ...meta, status: 'aborted' });

  console.log(pc.green(`Task ${taskKey} aborted.`));
  console.log(pc.dim(`Run data preserved at ${getRunDir(taskKey)}`));
}
