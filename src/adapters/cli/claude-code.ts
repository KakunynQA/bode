import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig, CliInvocationOptions } from '~/types/cli-adapter.ts';

export class ClaudeCodeAdapter extends BaseCliAdapter {
	readonly name = 'claude-code';

	getCommand(): string {
		return 'claude';
	}

	buildArgs(prompt: string, config: CliAdapterConfig, options: CliInvocationOptions): string[] {
		const args: string[] = ['--model', config.model];
		if (options.dangerousBypass) {
			args.push('--dangerously-skip-permissions');
		}
		if (!options.interactive) {
			args.push('--print');
		} else {
			args.push(prompt);
		}
		return args;
	}

	dangerousFlags(): string[] {
		return ['--dangerously-skip-permissions'];
	}
}
