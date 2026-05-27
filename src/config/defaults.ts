import type { BodeConfig } from './schema.ts';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_CONFIG: BodeConfig = {
	// `jira` defaults to empty since v0.21.0. When neither global config nor
	// project config sets credentials, bode uses the LocalTrackerAdapter.
	jira: {},
	phases: {
		planning: {
			cli: 'claude-code',
			model: 'claude-opus-4-7',
			timeout_minutes: 15,
		},
		implementation: {
			cli: 'opencode',
			model: 'claude-sonnet-4-6',
			timeout_minutes: 60,
		},
		review: {
			cli: 'opencode',
			model: 'claude-sonnet-4-6',
			timeout_minutes: 10,
		},
	},
	gates: {
		after_planning: true,
		after_implementation: true,
	},
	jira_labels: {
		planning: 'bode:planning',
		planned: 'bode:planned',
		implementing: 'bode:implementing',
		reviewing: 'bode:reviewing',
		reviewed: 'bode:reviewed',
		autopilot: 'bode:autopilot',
	},
	comment_format: {
		plan_inline_max_chars: 3000,
		use_emoji: true,
	},
};

export function getGlobalDir(): string {
	return join(homedir(), '.bode');
}

export function getGlobalConfigPath(): string {
	return join(getGlobalDir(), 'config.yml');
}

export function getRunsDir(): string {
	return join(getGlobalDir(), 'runs');
}

export function getSkillsDir(): string {
	return join(getGlobalDir(), 'skills');
}

export function getProjectsDir(): string {
	return join(getGlobalDir(), 'projects');
}

export function getRunDir(taskKey: string): string {
	return join(getRunsDir(), taskKey.toUpperCase());
}
