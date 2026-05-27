import { spawn } from 'node:child_process';
import type { CliAdapter, CliAdapterConfig, CliInvocationResult } from '~/types/cli-adapter.ts';
import type { Result } from '~/types/result.ts';

const isWindows = process.platform === 'win32';
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const TRUNCATION_NOTICE = '\n\n...[truncated: output exceeded 5MB]';

export abstract class BaseCliAdapter implements CliAdapter {
	abstract readonly name: string;

	abstract buildArgs(prompt: string, config: CliAdapterConfig): string[];
	abstract getCommand(): string;

	private spawnCli(
		command: string,
		args: string[],
		options: { stdio: ('pipe' | 'inherit' | 'ignore')[] }
	) {
		if (isWindows) {
			return spawn('cmd.exe', ['/c', command, ...args], { stdio: options.stdio });
		}
		return spawn(command, args, { stdio: options.stdio });
	}

	async invoke(
		prompt: string,
		config: CliAdapterConfig,
		signal?: AbortSignal
	): Promise<Result<CliInvocationResult>> {
		const start = Date.now();
		const args = this.buildArgs(prompt, config);
		const command = this.getCommand();

		try {
			const result = await new Promise<CliInvocationResult>((resolve, reject) => {
				const proc = this.spawnCli(command, args, {
					stdio: ['pipe', 'pipe', 'pipe'],
				});

				let stdout = '';
				let stderr = '';
				let stdoutBytes = 0;
				let stderrBytes = 0;
				let stdoutTruncated = false;
				let stderrTruncated = false;

				proc.stdout!.on('data', (data: Buffer) => {
					stdoutBytes += data.length;
					if (stdoutBytes <= MAX_OUTPUT_BYTES) {
						stdout += data.toString();
					} else if (!stdoutTruncated) {
						stdout += TRUNCATION_NOTICE;
						stdoutTruncated = true;
					}
				});

				proc.stderr!.on('data', (data: Buffer) => {
					stderrBytes += data.length;
					if (stderrBytes <= MAX_OUTPUT_BYTES) {
						stderr += data.toString();
					} else if (!stderrTruncated) {
						stderr += TRUNCATION_NOTICE;
						stderrTruncated = true;
					}
				});

				const timeoutMs = config.timeout_minutes * 60 * 1000;
				const timer = setTimeout(() => {
					proc.kill('SIGTERM');
					reject(new Error(`CLI timeout after ${config.timeout_minutes} minutes`));
				}, timeoutMs);

				const onAbort = () => {
					clearTimeout(timer);
					proc.kill('SIGTERM');
					reject(new Error('Aborted by user'));
				};
				signal?.addEventListener('abort', onAbort);

				proc.on('close', (code) => {
					clearTimeout(timer);
					signal?.removeEventListener('abort', onAbort);
					resolve({
						stdout,
						stderr,
						exitCode: code ?? 0,
						durationMs: Date.now() - start,
					});
				});

				proc.on('error', (err) => {
					clearTimeout(timer);
					signal?.removeEventListener('abort', onAbort);
					reject(err);
				});

				proc.stdin!.write(prompt);
				proc.stdin!.end();
			});

			return { ok: true, value: result };
		} catch (error) {
			return {
				ok: false,
				error: error as Error,
			};
		}
	}

	async isAvailable(): Promise<boolean> {
		try {
			const command = this.getCommand();
			const proc = this.spawnCli(command, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
			return await new Promise<boolean>((resolve) => {
				proc.on('close', (code) => resolve(code === 0));
				proc.on('error', () => resolve(false));
			});
		} catch {
			return false;
		}
	}
}
