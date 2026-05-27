import type { BodeConfig, ProjectConfig } from './schema.ts';

export type TransitionKey = 'planning' | 'implementation' | 'review' | 'awaiting_merge' | 'done';

/**
 * Sensible defaults that match a "Jira ticket stays In Progress until ready
 * for human review" workflow. The `awaiting_merge` event (PR opened) is the
 * one that hands the work to a reviewer, so it carries the visible status
 * change. Internal AI phases (implementation, review) don't move the card.
 */
const DEFAULTS: Record<TransitionKey, string> = {
	planning: 'In Progress',
	implementation: 'In Progress',
	review: 'In Progress',
	awaiting_merge: 'Code Review',
	done: 'Done',
};

/**
 * Returns the Jira transition name (or target status name) to use at a given
 * lifecycle event. Resolution order:
 *   1. project config jira.transitions.<key>
 *   2. global config jira.transitions.<key>
 *   3. built-in default
 *
 * An empty string means "do not transition" — useful when the user wants bode
 * to skip a particular transition (e.g. AI internal phases shouldn't move the
 * card on workflows that lack a matching column).
 *
 * The Jira REST adapter matches either by transition NAME or by target STATUS
 * name, so users can configure whichever fits their workflow.
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
		awaiting_merge: resolveJiraTransition('awaiting_merge', config, projectConfig),
		done: resolveJiraTransition('done', config, projectConfig),
	};
}
