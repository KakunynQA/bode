import { z } from 'zod';

const phaseConfigSchema = z.object({
  cli: z.string(),
  model: z.string(),
  skill: z.string().optional(),
  timeout_minutes: z.number().min(1).max(480),
});

export const bodeConfigSchema = z.object({
  jira: z.object({
    site: z.string(),
    default_project: z.string(),
  }),
  github: z
    .object({
      default_org: z.string(),
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
});

export type BodeConfig = z.infer<typeof bodeConfigSchema>;
