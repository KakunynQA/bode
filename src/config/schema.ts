import { z } from 'zod';

const hookEntrySchema = z.union([
	z.string(),
	z.object({ run: z.string(), non_blocking: z.boolean().optional() }),
]);

const hooksSchema = z
	.object({
		pre_planning: z.array(hookEntrySchema).optional(),
		post_planning: z.array(hookEntrySchema).optional(),
		pre_implementation: z.array(hookEntrySchema).optional(),
		post_implementation: z.array(hookEntrySchema).optional(),
		pre_review: z.array(hookEntrySchema).optional(),
		post_review: z.array(hookEntrySchema).optional(),
		pre_pr: z.array(hookEntrySchema).optional(),
		post_pr: z.array(hookEntrySchema).optional(),
	})
	.optional();

const phaseConfigSchema = z.object({
	cli: z.string(),
	model: z.string(),
	skill: z.string().optional(),
	timeout_minutes: z.number().min(1).max(480),
});

const validationSchema = z.array(z.string().min(1)).optional();

const releaseSchema = z
	.object({
		require_version_bump: z.boolean().optional(),
		require_changelog_entry: z.boolean().optional(),
		rebuild_command: z.string().optional(),
	})
	.optional();

const budgetSchema = z
	.object({
		per_task_max_usd: z.number().positive().optional(),
		per_phase_max_usd: z.number().positive().optional(),
		daily_max_usd: z.number().positive().optional(),
		abort_on_breach: z.boolean().optional(),
		warn_at_pct: z.number().min(1).max(100).optional(),
		fallback_if_no_usage_data: z.enum(['continue', 'abort']).optional(),
	})
	.optional();

const concurrencySchema = z
	.object({ max_tasks: z.number().int().positive().max(32).optional() })
	.optional();

const memorySchema = z.object({ enabled: z.boolean().optional() }).optional();

const jiraTransitionsSchema = z
	.object({
		planning: z.string().optional(),
		implementation: z.string().optional(),
		review: z.string().optional(),
		awaiting_merge: z.string().optional(),
		done: z.string().optional(),
	})
	.optional();

export const bodeConfigSchema = z.object({
	// `jira` is optional since v0.21.0 — when absent or empty, bode falls back
	// to the LocalTrackerAdapter (`.bode/tasks/<key>.md` files).
	jira: z
		.object({
			site: z.string().optional(),
			default_project: z.string().optional(),
			email: z.string().optional(),
			api_token: z.string().optional(),
			transitions: jiraTransitionsSchema,
		})
		.optional()
		.default({}),
	github: z
		.object({
			default_org: z.string(),
		})
		.optional(),
	/**
	 * Explicit tracker selection (v0.24.0+). When set, overrides the auto-select
	 * logic in `selectTracker`. Useful for users who have Jira configured but
	 * want a specific project to use GitHub Issues, or vice versa.
	 *
	 * Values: `jira` | `github-issues` | `local` | `mock`.
	 */
	tracker: z
		.enum([
			'jira',
			'github-issues',
			'linear',
			'notion',
			'trello',
			'local',
			'plain-markdown',
			'mock',
		])
		.optional(),
	linear: z
		.object({
			/** Linear API key. Prefer the LINEAR_API_KEY env var over storing here. */
			api_key: z.string().optional(),
		})
		.optional(),
	notion: z
		.object({
			/** Notion integration token. Prefer NOTION_TOKEN env var. */
			api_token: z.string().optional(),
			/** Notion database ID where bode tasks live. */
			database_id: z.string().optional(),
			/** Optional property name overrides. Defaults: Name / Status / Tags. */
			properties: z
				.object({
					title: z.string().optional(),
					status: z.string().optional(),
					tags: z.string().optional(),
				})
				.optional(),
		})
		.optional(),
	trello: z
		.object({
			/** Trello API key. Get one at trello.com/app-key. */
			api_key: z.string().optional(),
			/** Trello API token. Generated alongside the api_key. */
			token: z.string().optional(),
			/** Trello board ID where bode tasks live. */
			board_id: z.string().optional(),
		})
		.optional(),
	vcs: z
		.object({
			provider: z.enum(['github', 'gitlab']).default('github'),
		})
		.optional(),
	phases: z.object({
		planning: phaseConfigSchema,
		plan_review: phaseConfigSchema.optional(),
		implementation: phaseConfigSchema,
		review: phaseConfigSchema,
	}),
	validation: validationSchema,
	release: releaseSchema,
	budget: budgetSchema,
	concurrency: concurrencySchema,
	memory: memorySchema,
	gates: z
		.object({
			after_planning: z.boolean(),
			after_implementation: z.boolean(),
		})
		.optional(),
	jira_labels: z
		.object({
			planning: z.string(),
			planned: z.string(),
			implementing: z.string(),
			reviewing: z.string(),
			reviewed: z.string(),
			autopilot: z.string(),
		})
		.optional(),
	comment_format: z
		.object({
			plan_inline_max_chars: z.number().optional(),
			use_emoji: z.boolean().optional(),
		})
		.optional(),
	defaults: z
		.object({
			project: z.string().optional(),
		})
		.optional(),
	hooks: hooksSchema,
});

export type BodeConfig = z.infer<typeof bodeConfigSchema>;

const reposItemSchema = z.object({
	workdir: z.string().min(1),
	name: z.string().optional(),
	path: z.string().optional(),
	role: z.string().optional(),
	optional: z.boolean().optional(),
});

export const projectConfigSchema = z.object({
	name: z.string().min(1),
	workdir: z.string().min(1),
	default_branch: z.string().optional(),
	vcs_provider: z.enum(['github', 'gitlab']).optional(),
	jira: z
		.object({
			site: z.string().optional(),
			default_project: z.string().optional(),
			transitions: jiraTransitionsSchema,
		})
		.optional(),
	context_paths: z.array(z.string()).optional(),
	context_files: z.array(z.string()).optional(),
	phases: z
		.object({
			planning: phaseConfigSchema.partial().optional(),
			plan_review: phaseConfigSchema.partial().optional(),
			implementation: phaseConfigSchema.partial().optional(),
			review: phaseConfigSchema.partial().optional(),
		})
		.optional(),
	validation: validationSchema,
	release: releaseSchema,
	budget: budgetSchema,
	concurrency: concurrencySchema,
	memory: memorySchema,
	branch_tool: z.string().optional(),
	repos: z.array(reposItemSchema).optional(),
	skill_sources_allowed: z.array(z.string()).optional(),
	tracker: z
		.enum([
			'jira',
			'github-issues',
			'linear',
			'notion',
			'trello',
			'local',
			'plain-markdown',
			'mock',
		])
		.optional(),
	hooks: hooksSchema,
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
