import type { Result } from './result.ts';

export type CliAdapterConfig = {
  cli: string;
  model: string;
  timeout_minutes: number;
};

export type CliInvocationResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export interface CliAdapter {
  readonly name: string;
  invoke(
    prompt: string,
    config: CliAdapterConfig,
    signal?: AbortSignal
  ): Promise<Result<CliInvocationResult>>;
  isAvailable(): Promise<boolean>;
}
