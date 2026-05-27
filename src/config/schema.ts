import { z } from 'zod';

const phaseConfigSchema = z.object({
	cli: z.string(),
	model: z.string(),
	skill: z.string().optional(),
	timeout_minutes: z.number().min(1).max(480),
});

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
	vcs: z
		.object({
			provider: z.enum(['github', 'gitlab']).default('github'),
		})
		.optional(),
	phases: z.object({
		planning: phaseConfigSchema,
		implementation: phaseConfigSchema,
		review: phaseConfigSchema,
	}),
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
});

export type BodeConfig = z.infer<typeof bodeConfigSchema>;

const reposItemSchema = z.object({
	workdir: z.string().min(1),
	name: z.string().optional(),
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
			implementation: phaseConfigSchema.partial().optional(),
			review: phaseConfigSchema.partial().optional(),
		})
		.optional(),
	branch_tool: z.string().optional(),
	repos: z.array(reposItemSchema).optional(),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
