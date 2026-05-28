import type { PhaseStatus } from '~/types/phase.ts';
import { getRunDir } from '~/config/defaults.ts';
import { readJson, writeJson, ensureDir } from '~/utils/fs.ts';
import { join } from 'node:path';
import type { Result } from '~/types/result.ts';

export type RunMeta = {
	taskKey: string;
	trackerSummary: string;
	status: PhaseStatus;
	startedAt: number;
	updatedAt: number;
	currentPhaseLog?: string;
	error?: string;
	branch?: string;
	baseBranch?: string;
	prUrl?: string;
	prNumber?: number;
	conflict?: boolean;
	projectName?: string;
	workdir?: string;
};

export async function loadRunMeta(taskKey: string): Promise<Result<RunMeta | null>> {
	try {
		const path = join(getRunDir(taskKey), 'meta.json');
		const data = await readJson<RunMeta>(path);
		return { ok: true, value: data };
	} catch (error) {
		return { ok: false, error: error as Error };
	}
}

export async function saveRunMeta(meta: RunMeta): Promise<Result<void>> {
	try {
		const dir = getRunDir(meta.taskKey);
		await ensureDir(dir);
		const path = join(dir, 'meta.json');
		await writeJson(path, { ...meta, updatedAt: Date.now() });
		return { ok: true, value: undefined };
	} catch (error) {
		return { ok: false, error: error as Error };
	}
}

export async function createRun(
	taskKey: string,
	summary: string,
	options?: { branch?: string; baseBranch?: string; projectName?: string; workdir?: string }
): Promise<Result<RunMeta>> {
	const meta: RunMeta = {
		taskKey,
		trackerSummary: summary,
		status: 'pending',
		startedAt: Date.now(),
		updatedAt: Date.now(),
		...(options?.branch !== undefined ? { branch: options.branch } : {}),
		...(options?.baseBranch !== undefined ? { baseBranch: options.baseBranch } : {}),
		...(options?.projectName !== undefined ? { projectName: options.projectName } : {}),
		...(options?.workdir !== undefined ? { workdir: options.workdir } : {}),
	};
	const result = await saveRunMeta(meta);
	if (!result.ok) return result;
	return { ok: true, value: meta };
}
