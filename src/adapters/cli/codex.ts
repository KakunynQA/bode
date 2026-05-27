import { BaseCliAdapter } from './base.ts';
import type { CliAdapterConfig, CliInvocationOptions } from '~/types/cli-adapter.ts';

export class CodexAdapter extends BaseCliAdapter {
	readonly name = 'codex';

	getCommand(): string {
		return 'codex';
	}

	buildArgs(prompt: string, config: CliAdapterConfig, options: CliInvocationOptions): string[] {
		const args: string[] = [];
		if (!options.interactive) {
			args.push('exec', '--model', config.model);
			if (options.dangerousBypass) {
				args.push('--dangerously-bypass-approvals-and-sandbox');
			}
			args.push('--prompt-file', '/dev/stdin');
		} else {
			args.push('--model', config.model);
			if (options.dangerousBypass) {
				args.push('--dangerously-bypass-approvals-and-sandbox');
			}
			args.push(prompt);
		}
		return args;
	}

	dangerousFlags(): string[] {
		return ['--dangerously-bypass-approvals-and-sandbox'];
	}
}
