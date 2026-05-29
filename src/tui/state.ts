import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from '~/config/loader.ts';
import { listProjects, loadProjectConfig } from '~/config/projects.ts';
import { projectConfigSchema, type ProjectConfig } from '~/config/schema.ts';
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

// Non-interactive lookup for the header. Never enters the inquirer
// "Which project?" picker — when ambiguous, returns null and the header
// shows "no project configured" instead of blocking the shell.
async function readRepoLocalProject(cwd: string): Promise<ProjectConfig | null> {
	let dir = cwd;
	while (true) {
		const candidate = join(dir, '.bode.yml');
		if (existsSync(candidate)) {
			try {
				const raw = await readFile(candidate, 'utf-8');
				const parsed = parseYaml(raw);
				if (parsed && typeof parsed === 'object') {
					const withDefaults = { workdir: dir, name: 'repo-local', ...parsed };
					const result = projectConfigSchema.safeParse(withDefaults);
					if (result.success) return result.data;
				}
			} catch {
				// fall through
			}
			return null;
		}
		const parent = join(dir, '..');
		if (parent === dir) return null;
		dir = parent;
	}
}

export async function resolveCurrentProject(
	cwd: string = process.cwd()
): Promise<ResolvedProjectSummary | null> {
	try {
		const configResult = await loadConfig(cwd);
		if (!configResult.ok) return null;
		const config = configResult.value;

		let projectConfig: ProjectConfig | null = await readRepoLocalProject(cwd);

		if (!projectConfig) {
			const named = config.defaults?.project;
			if (named) {
				const loaded = await loadProjectConfig(named);
				if (loaded.ok && loaded.value) projectConfig = loaded.value;
			}
		}

		if (!projectConfig) {
			const projects = await listProjects();
			if (projects.ok && projects.value.length === 1) {
				const only = projects.value[0]!;
				const loaded = await loadProjectConfig(only.name);
				if (loaded.ok && loaded.value) projectConfig = loaded.value;
			}
		}

		if (!projectConfig) return null;

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
