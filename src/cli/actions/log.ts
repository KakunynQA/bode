import { getRunDir } from '~/config/defaults.ts';
import { readText } from '~/utils/fs.ts';
import pc from 'picocolors';

export async function logAction(taskKey: string): Promise<void> {
	const { readdir } = await import('node:fs/promises');
	const { join } = await import('node:path');
	const runDir = getRunDir(taskKey);

	try {
		const files = await readdir(runDir);
		const logFiles = files.filter((f) => f.endsWith('.log')).sort();

		if (logFiles.length === 0) {
			console.error(pc.yellow(`No logs found for ${taskKey}`));
			return;
		}

		const latest = logFiles[logFiles.length - 1];
		if (!latest) {
			console.error(pc.yellow('No log file available'));
			return;
		}

		const content = await readText(join(runDir, latest));
		if (content) {
			console.log(content);
		}
	} catch {
		console.error(pc.yellow(`No run directory found for ${taskKey}`));
	}
}
