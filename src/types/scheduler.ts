import type { PhaseStatus } from './phase.ts';

export type SchedulerTaskStatus =
	| 'queued'
	| 'running'
	| 'done'
	| 'failed'
	| 'crashed'
	| 'cancelled';

export type SchedulerTask = {
	key: string;
	repo: string;
	branch?: string;
	worktree?: string;
	phase: PhaseStatus;
	status: SchedulerTaskStatus;
	pid: number;
	started_at: string;
	updated_at: string;
	cli?: string;
	model?: string;
};

export type SchedulerState = {
	tasks: SchedulerTask[];
	updated_at: string;
};
