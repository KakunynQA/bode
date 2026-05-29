import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getSchedulerPath } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';
import type { PhaseStatus } from '~/types/phase.ts';
import type { SchedulerState, SchedulerTask, SchedulerTaskStatus } from '~/types/scheduler.ts';

export async function readScheduler(): Promise<SchedulerState> {
	const path = getSchedulerPath();
	if (!existsSync(path)) return emptyState();
	try {
		const parsed = JSON.parse(await readFile(path, 'utf-8')) as SchedulerState;
		return reapCrashed(parsed);
	} catch {
		return emptyState();
	}
}

export async function upsertSchedulerTask(task: SchedulerTask): Promise<Result<void>> {
	const state = await readScheduler();
	const idx = state.tasks.findIndex((t) => t.key.toUpperCase() === task.key.toUpperCase());
	if (idx >= 0) state.tasks[idx] = task;
	else state.tasks.push(task);
	await writeScheduler(state);
	return { ok: true, value: undefined };
}

export async function updateSchedulerTask(
	key: string,
	patch: Partial<Pick<SchedulerTask, 'status' | 'phase' | 'branch' | 'worktree'>>
): Promise<void> {
	const state = await readScheduler();
	const task = state.tasks.find((t) => t.key.toUpperCase() === key.toUpperCase());
	if (!task) return;
	Object.assign(task, patch, { updated_at: new Date().toISOString() });
	await writeScheduler(state);
}

export async function removeSchedulerTask(key: string): Promise<void> {
	const state = await readScheduler();
	state.tasks = state.tasks.filter((t) => t.key.toUpperCase() !== key.toUpperCase());
	await writeScheduler(state);
}

export function createSchedulerTask(options: {
	key: string;
	repo: string;
	phase: PhaseStatus;
	status?: SchedulerTaskStatus;
	cli?: string;
	model?: string;
}): SchedulerTask {
	const now = new Date().toISOString();
	return {
		key: options.key,
		repo: options.repo,
		phase: options.phase,
		status: options.status ?? 'running',
		pid: process.pid,
		started_at: now,
		updated_at: now,
		...(options.cli ? { cli: options.cli } : {}),
		...(options.model ? { model: options.model } : {}),
	};
}

async function writeScheduler(state: SchedulerState): Promise<void> {
	const path = getSchedulerPath();
	await mkdir(dirname(path), { recursive: true });
	state.updated_at = new Date().toISOString();
	await writeFile(path, JSON.stringify(state, null, 2), 'utf-8');
}

function emptyState(): SchedulerState {
	return { tasks: [], updated_at: new Date().toISOString() };
}

function reapCrashed(state: SchedulerState): SchedulerState {
	for (const task of state.tasks) {
		if (task.status === 'running' && !isPidAlive(task.pid)) {
			task.status = 'crashed';
			task.updated_at = new Date().toISOString();
		}
	}
	return state;
}

function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
