import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig } from '~/types/cli-adapter.ts';

export class ZaiAdapter extends BaseCliAdapter {
	readonly name = 'zai';

	getCommand(): string {
		return 'zai-coding';
	}

	buildArgs(_prompt: string, config: CliAdapterConfig): string[] {
		return ['--model', config.model, '--prompt-file', '/dev/stdin'];
	}
}
