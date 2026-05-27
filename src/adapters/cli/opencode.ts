import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig, CliInvocationOptions } from '~/types/cli-adapter.ts';

export class OpenCodeAdapter extends BaseCliAdapter {
	readonly name = 'opencode';

	getCommand(): string {
		return 'opencode';
	}

	buildArgs(prompt: string, config: CliAdapterConfig, options: CliInvocationOptions): string[] {
		const args: string[] = [];
		if (!options.interactive) {
			args.push('run', '--model', config.model, '--prompt-file', '/dev/stdin');
		} else {
			args.push('--model', config.model, prompt);
		}
		return args;
	}

	// OpenCode does not expose a single equivalent flag for full bypass.
	// Returning null causes bode to warn the user upfront when --approve-all-dangerous
	// is used with this adapter.
	dangerousFlags(): string[] | null {
		return null;
	}
}
