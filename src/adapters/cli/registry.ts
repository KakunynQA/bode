import type { CliAdapter } from '~/types/cli-adapter.ts';
import type { Result } from '~/types/result.ts';
import { unknownAdapterError } from '~/utils/errors.ts';
import { ClaudeCodeAdapter } from './claude-code.ts';
import { OpenCodeAdapter } from './opencode.ts';
import { CodexAdapter } from './codex.ts';

const adapters = new Map<string, () => CliAdapter>();

function registerDefaults(): void {
	adapters.set('claude-code', () => new ClaudeCodeAdapter());
	adapters.set('opencode', () => new OpenCodeAdapter());
	adapters.set('codex', () => new CodexAdapter());
}

registerDefaults();

export function registerAdapter(name: string, factory: () => CliAdapter): void {
	adapters.set(name, factory);
}

export function getAdapter(name: string): Result<CliAdapter> {
	const factory = adapters.get(name);
	if (!factory) {
		return {
			ok: false,
			error: unknownAdapterError('CLI', name, [...adapters.keys()]),
		};
	}
	return { ok: true, value: factory() };
}

export function listAdapterNames(): string[] {
	return [...adapters.keys()];
}
