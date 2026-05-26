import { spawn } from 'node:child_process';
import type { CliAdapter, CliAdapterConfig, CliInvocationResult } from '~/types/cli-adapter.ts';
import type { Result } from '~/types/result.ts';

export abstract class BaseCliAdapter implements CliAdapter {
  abstract readonly name: string;

  abstract buildArgs(prompt: string, config: CliAdapterConfig): string[];
  abstract getCommand(): string;

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
        const proc = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 0,
            durationMs: Date.now() - start,
          });
        });

        proc.on('error', reject);

        proc.stdin.write(prompt);
        proc.stdin.end();

        const timeoutMs = config.timeout_minutes * 60 * 1000;
        const timer = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`CLI timeout after ${config.timeout_minutes} minutes`));
        }, timeoutMs);

        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          proc.kill('SIGTERM');
          reject(new Error('Aborted by user'));
        });

        proc.on('close', () => clearTimeout(timer));
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
      const { execSync } = await import('node:child_process');
      execSync(`${this.getCommand()} --version`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
