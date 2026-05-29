import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import {
	appendMemoryNote,
	disableMemory,
	initMemory,
	memoryDirForProject,
	readProjectMemory,
} from '~/utils/memory-store.ts';

export async function memoryAction(subcommand: string | undefined, args: string[]): Promise<void> {
	const workdir = process.cwd();
	switch (subcommand ?? 'show') {
		case 'init': {
			const dir = await initMemory(workdir);
			console.log(pc.green(`Memory enabled: ${dir}`));
			return;
		}
		case 'show': {
			console.log((await readProjectMemory(workdir)) ?? pc.dim('Memory is not enabled.'));
			return;
		}
		case 'add': {
			const note = args.join(' ').trim();
			if (!note) throw new Error('Usage: bode memory add "<note>"');
			await appendMemoryNote(workdir, note);
			console.log(pc.green('Memory note added.'));
			return;
		}
		case 'edit': {
			const dir = await initMemory(workdir);
			const editor = process.env['EDITOR'] ?? 'notepad';
			spawn(editor, [join(dir, 'notes.md')], { stdio: 'inherit', shell: true });
			return;
		}
		case 'off': {
			await disableMemory(workdir);
			console.log(pc.green('Memory disabled for prompt injection.'));
			return;
		}
		case 'prune': {
			const dir = memoryDirForProject(workdir);
			console.log(
				existsSync(dir) ? pc.dim(`Review and prune files in ${dir}`) : pc.dim('No memory dir.')
			);
			return;
		}
		default:
			console.error(pc.red(`Unknown memory command: ${subcommand}`));
			process.exit(1);
	}
}

export function readMemoryFileForTests(projectPath: string, file: string): string | null {
	const path = join(memoryDirForProject(projectPath), file);
	return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}
