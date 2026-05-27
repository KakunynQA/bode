import { spawn, type StdioOptions } from 'node:child_process';
import type {
	CliAdapter,
	CliAdapterConfig,
	CliInvocationOptions,
	CliInvocationResult,
} from '~/types/cli-adapter.ts';
import type { Result } from '~/types/result.ts';

const isWindows = process.platform === 'win32';
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const TRUNCATION_NOTICE = '\n\n...[truncated: output exceeded 5MB]';

export abstract class BaseCliAdapter implements CliAdapter {
	abstract readonly name: string;

	abstract buildArgs(
		prompt: string,
		config: CliAdapterConfig,
		options: CliInvocationOptions
	): string[];
	abstract getCommand(): string;

	/**
	 * Returns the CLI-specific flag(s) that disable approval prompts and sandboxing
	 * when bode is invoked with `--approve-all-dangerous`. Returns null when the
	 * underlying CLI has no equivalent — callers should warn the user upfront so
	 * they understand they may need to approve actions interactively.
	 */
	dangerousFlags(): string[] | null {
		return null;
	}

	/**
	 * Whether this adapter supports interactive mode (stdio inherit, user drives
	 * the AI session in their terminal). Default true — override to false only
	 * if the CLI cannot be used interactively at all.
	 */
	supportsInteractive(): boolean {
		return true;
	}

	private spawnCli(command: string, args: string[], stdio: StdioOptions) {
		if (isWindows) {
			return spawn('cmd.exe', ['/c', command, ...args], { stdio });
		}
		return spawn(command, args, { stdio });
	}

	async invoke(
		prompt: string,
		config: CliAdapterConfig,
		options: CliInvocationOptions = {}
	): Promise<Result<CliInvocationResult>> {
		const interactive = options.interactive ?? false;
		if (interactive) {
			return this.invokeInteractive(prompt, config, options);
		}
		return this.invokeHeadless(prompt, config, options);
	}

	private async invokeInteractive(
		prompt: string,
		config: CliAdapterConfig,
		options: CliInvocationOptions
	): Promise<Result<CliInvocationResult>> {
		const start = Date.now();
		const args = this.buildArgs(prompt, config, options);
		const command = this.getCommand();
		const { signal } = options;

		try {
			const result = await new Promise<CliInvocationResult>((resolve, reject) => {
				const proc = this.spawnCli(command, args, ['inherit', 'inherit', 'inherit']);

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
						stdout: '',
						stderr: '',
						exitCode: code ?? 0,
						durationMs: Date.now() - start,
					});
				});

				proc.on('error', (err) => {
					clearTimeout(timer);
					signal?.removeEventListener('abort', onAbort);
					reject(err);
				});
			});

			return { ok: true, value: result };
		} catch (error) {
			return { ok: false, error: error as Error };
		}
	}

	private async invokeHeadless(
		prompt: string,
		config: CliAdapterConfig,
		options: CliInvocationOptions
	): Promise<Result<CliInvocationResult>> {
		const start = Date.now();
		const args = this.buildArgs(prompt, config, options);
		const command = this.getCommand();
		const { signal } = options;

		try {
			const result = await new Promise<CliInvocationResult>((resolve, reject) => {
				const proc = this.spawnCli(command, args, ['pipe', 'pipe', 'pipe']);

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
			return { ok: false, error: error as Error };
		}
	}

	async isAvailable(): Promise<boolean> {
		try {
			const command = this.getCommand();
			const proc = this.spawnCli(command, ['--version'], ['ignore', 'ignore', 'ignore']);
			return await new Promise<boolean>((resolve) => {
				proc.on('close', (code) => resolve(code === 0));
				proc.on('error', () => resolve(false));
			});
		} catch {
			return false;
		}
	}
}
