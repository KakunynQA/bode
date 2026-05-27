import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig } from '~/types/cli-adapter.ts';

export class CodexAdapter extends BaseCliAdapter {
	readonly name = 'codex';

	getCommand(): string {
		return 'codex';
	}

	buildArgs(_prompt: string, config: CliAdapterConfig): string[] {
		return ['exec', '--model', config.model, '--prompt-file', '/dev/stdin'];
	}
}
