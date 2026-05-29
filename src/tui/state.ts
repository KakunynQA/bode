import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '~/config/loader.ts';
import { resolveProject } from '~/config/project-resolver.ts';
import { selectTracker, type TrackerKind } from '~/adapters/tracker/factory.ts';
import { getRunsDir } from '~/config/defaults.ts';
import type { RunMeta } from '~/storage/run-meta.ts';
import { getVersion } from '~/utils/version.ts';

export type ResolvedProjectSummary = {
	name: string;
	workdir: string;
	trackerKind: TrackerKind;
};

export type ActiveRunSummary = {
	key: string;
	phase: string;
};

export type ShellState = {
	version: string;
	project: ResolvedProjectSummary | null;
	activeRun: ActiveRunSummary | null;
};

export async function resolveCurrentProject(
	cwd: string = process.cwd()
): Promise<ResolvedProjectSummary | null> {
	try {
		const configResult = await loadConfig(cwd);
		if (!configResult.ok) return null;
		const config = configResult.value;
		const projectResult = await resolveProject(config, { cwd });
		if (!projectResult.ok) return null;
		const { projectConfig } = projectResult.value;
		const tracker = selectTracker({
			workdir: projectConfig.workdir,
			tracker: config.tracker,
			...(config.jira ? { jira: config.jira } : {}),
			...(config.linear ? { linear: config.linear } : {}),
			...(config.notion ? { notion: config.notion } : {}),
			...(config.trello ? { trello: config.trello } : {}),
		});
		return {
			name: projectConfig.name,
			workdir: projectConfig.workdir,
			trackerKind: tracker.kind,
		};
	} catch {
		return null;
	}
}

export async function findLatestRun(runsDir: string): Promise<ActiveRunSummary | null> {
	if (!existsSync(runsDir)) return null;
	let entries: string[];
	try {
		entries = await readdir(runsDir);
	} catch {
		return null;
	}
	let bestKey: string | null = null;
	let bestMtime = -1;
	for (const key of entries) {
		const metaPath = join(runsDir, key, 'meta.json');
		if (!existsSync(metaPath)) continue;
		try {
			const mtime = statSync(metaPath).mtimeMs;
			if (mtime > bestMtime) {
				bestMtime = mtime;
				bestKey = key;
			}
		} catch {
			// ignore unreadable entries
		}
	}
	if (!bestKey) return null;
	try {
		const raw = await readFile(join(runsDir, bestKey, 'meta.json'), 'utf-8');
		const meta = JSON.parse(raw) as RunMeta;
		return { key: meta.taskKey, phase: meta.status };
	} catch {
		return null;
	}
}

export async function loadInitialState(
	options: { cwd?: string; runsDir?: string } = {}
): Promise<ShellState> {
	const cwd = options.cwd ?? process.cwd();
	const runsDir = options.runsDir ?? getRunsDir();
	const [project, activeRun] = await Promise.all([
		resolveCurrentProject(cwd),
		findLatestRun(runsDir),
	]);
	return {
		version: getVersion(),
		project,
		activeRun,
	};
}
