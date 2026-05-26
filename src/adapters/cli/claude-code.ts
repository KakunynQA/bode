import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig } from '~/types/cli-adapter.ts';

export class ClaudeCodeAdapter extends BaseCliAdapter {
  readonly name = 'claude-code';

  getCommand(): string {
    return 'claude';
  }

  buildArgs(_prompt: string, config: CliAdapterConfig): string[] {
    return ['--print', '--model', config.model];
  }
}
