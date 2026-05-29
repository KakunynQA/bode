import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getUsageDir } from '~/config/defaults.ts';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import type { Result } from '~/types/result.ts';

type UsageState = {
	date: string;
	tasks: Record<string, { total_usd: number; phases: Record<string, number> }>;
};

export function getBudget(config: BodeConfig, project?: ProjectConfig): BodeConfig['budget'] {
	return project?.budget ?? config.budget;
}

export async function assertBudgetAvailable(options: {
	taskKey: string;
	phase: string;
	config: BodeConfig;
	projectConfig?: ProjectConfig;
	noBudget?: boolean;
}): Promise<Result<void>> {
	if (options.noBudget) return { ok: true, value: undefined };
	const budget = getBudget(options.config, options.projectConfig);
	if (!budget) return { ok: true, value: undefined };
	const usage = await readTodayUsage();
	const task = usage.tasks[options.taskKey.toUpperCase()];
	const total = task?.total_usd ?? 0;
	const phase = task?.phases[options.phase] ?? 0;
	const daily = Object.values(usage.tasks).reduce((sum, entry) => sum + entry.total_usd, 0);
	const abortOnBreach = budget.abort_on_breach ?? true;
	const breach =
		(budget.per_task_max_usd !== undefined && total >= budget.per_task_max_usd) ||
		(budget.per_phase_max_usd !== undefined && phase >= budget.per_phase_max_usd) ||
		(budget.daily_max_usd !== undefined && daily >= budget.daily_max_usd);
	if (breach && abortOnBreach) {
		return { ok: false, error: new Error('BODE_BUDGET_EXCEEDED: configured budget cap reached') };
	}
	return { ok: true, value: undefined };
}

export async function recordPhaseCost(taskKey: string, phase: string, usd: number): Promise<void> {
	if (usd <= 0) return;
	const usage = await readTodayUsage();
	const key = taskKey.toUpperCase();
	usage.tasks[key] ??= { total_usd: 0, phases: {} };
	usage.tasks[key].total_usd += usd;
	usage.tasks[key].phases[phase] = (usage.tasks[key].phases[phase] ?? 0) + usd;
	await writeTodayUsage(usage);
}

export async function getTaskCost(taskKey: string): Promise<number> {
	const usage = await readTodayUsage();
	return usage.tasks[taskKey.toUpperCase()]?.total_usd ?? 0;
}

export async function getTaskPhaseCosts(taskKey: string): Promise<Record<string, number>> {
	const usage = await readTodayUsage();
	return usage.tasks[taskKey.toUpperCase()]?.phases ?? {};
}

async function readTodayUsage(): Promise<UsageState> {
	const path = todayPath();
	if (!existsSync(path)) return { date: today(), tasks: {} };
	try {
		return JSON.parse(await readFile(path, 'utf-8')) as UsageState;
	} catch {
		return { date: today(), tasks: {} };
	}
}

async function writeTodayUsage(usage: UsageState): Promise<void> {
	await mkdir(getUsageDir(), { recursive: true });
	await writeFile(todayPath(), JSON.stringify(usage, null, 2), 'utf-8');
}

function todayPath(): string {
	return join(getUsageDir(), `${today()}.json`);
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}
