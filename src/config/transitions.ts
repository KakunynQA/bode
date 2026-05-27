import type { BodeConfig, ProjectConfig } from './schema.ts';

export type TransitionKey = 'planning' | 'implementation' | 'review' | 'done';

const DEFAULTS: Record<TransitionKey, string> = {
	planning: 'In Progress',
	implementation: 'In Review',
	review: 'Code Review',
	done: 'Done',
};

/**
 * Returns the Jira transition name (or target status name) to use when
 * advancing into a given phase. Resolution order:
 *   1. project config jira.transitions.<key>
 *   2. global config jira.transitions.<key>
 *   3. built-in default
 *
 * The Jira REST adapter matches either by transition NAME or by target
 * STATUS name, so users can configure whichever fits their workflow.
 */
export function resolveJiraTransition(
	key: TransitionKey,
	config: BodeConfig,
	projectConfig?: ProjectConfig
): string {
	return projectConfig?.jira?.transitions?.[key] ?? config.jira.transitions?.[key] ?? DEFAULTS[key];
}

export function listConfiguredTransitions(
	config: BodeConfig,
	projectConfig?: ProjectConfig
): Record<TransitionKey, string> {
	return {
		planning: resolveJiraTransition('planning', config, projectConfig),
		implementation: resolveJiraTransition('implementation', config, projectConfig),
		review: resolveJiraTransition('review', config, projectConfig),
		done: resolveJiraTransition('done', config, projectConfig),
	};
}
