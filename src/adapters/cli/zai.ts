import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig, CliInvocationOptions } from '~/types/cli-adapter.ts';

export class ZaiAdapter extends BaseCliAdapter {
	readonly name = 'zai';

	getCommand(): string {
		return 'zai-coding';
	}

	buildArgs(prompt: string, config: CliAdapterConfig, options: CliInvocationOptions): string[] {
		const args: string[] = [];
		if (!options.interactive) {
			args.push('--model', config.model, '--prompt-file', '/dev/stdin');
		} else {
			args.push('--model', config.model, prompt);
		}
		return args;
	}

	// Z.AI has no documented bypass flag — warn the user upfront when
	// --approve-all-dangerous is used with this adapter.
	dangerousFlags(): string[] | null {
		return null;
	}
}
