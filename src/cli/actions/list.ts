import { readdir } from 'node:fs/promises';
import { getRunsDir } from '~/config/defaults.ts';
import { loadRunMeta } from '~/storage/run-meta.ts';
import { getPhaseStatusLabel } from '~/types/phase.ts';
import pc from 'picocolors';

export async function listAction(): Promise<void> {
  const runsDir = getRunsDir();

  try {
    const entries = await readdir(runsDir);
    if (entries.length === 0) {
      console.log(pc.dim('No tasks tracked. Run "bode start <KEY>" to begin.'));
      return;
    }

    for (const entry of entries) {
      const result = await loadRunMeta(entry);
      if (result.ok && result.value) {
        const meta = result.value;
        console.log(
          `${pc.bold(meta.taskKey)} ${pc.dim('-')} ${meta.jiraSummary} ${pc.dim('|')} ${getPhaseStatusLabel(meta.status)}`
        );
      }
    }
  } catch {
    console.log(pc.dim('No tasks tracked. Run "bode start <KEY>" to begin.'));
  }
}
