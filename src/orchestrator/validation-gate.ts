import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { writeText } from '~/utils/fs.ts';
import { getRunDir } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';

export type ValidationGateResult = {
	logPath: string;
	commands: Array<{ command: string; exitCode: number }>;
};

export async function runValidationGate(options: {
	taskKey: string;
	workdir: string;
	commands: string[];
}): Promise<Result<ValidationGateResult>> {
	const logPath = join(getRunDir(options.taskKey), 'validation.log');
	const results: ValidationGateResult['commands'] = [];
	const log: string[] = [];

	for (const command of options.commands) {
		log.push(`$ ${command}`);
		const result = await runShell(command, options.workdir);
		results.push({ command, exitCode: result.exitCode });
		log.push(result.output.trim(), '');
		await writeText(logPath, log.join('\n'));
		if (result.exitCode !== 0) {
			return {
				ok: false,
				error: new Error(`Validation failed: ${command} (exit ${result.exitCode})`),
			};
		}
	}

	return { ok: true, value: { logPath, commands: results } };
}

function runShell(command: string, cwd: string): Promise<{ exitCode: number; output: string }> {
	return new Promise((resolve) => {
		const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
		let output = '';
		child.stdout.on('data', (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.stderr.on('data', (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.on('close', (code) => resolve({ exitCode: code ?? 1, output }));
		child.on('error', (error) => resolve({ exitCode: 1, output: error.message }));
	});
}
