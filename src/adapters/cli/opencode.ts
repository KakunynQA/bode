import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig } from '~/types/cli-adapter.ts';

export class OpenCodeAdapter extends BaseCliAdapter {
  readonly name = 'opencode';

  getCommand(): string {
    return 'opencode';
  }

  buildArgs(_prompt: string, config: CliAdapterConfig): string[] {
    return ['run', '--model', config.model, '--prompt-file', '/dev/stdin'];
  }
}
