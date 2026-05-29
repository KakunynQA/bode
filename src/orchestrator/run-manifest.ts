import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { getRunDir } from '~/config/defaults.ts';
import { readJson, writeJson } from '~/utils/fs.ts';

export type ManifestPhase = {
	phase: string;
	prompt_path: string;
	prompt_sha256: string;
	skill_sha256: string;
	model: string;
	cli: string;
	flags: string[];
	created_at: string;
};

export type RunManifest = {
	version: 1;
	task_key: string;
	created_at: string;
	updated_at: string;
	phases: ManifestPhase[];
};

export async function recordManifestPhase(options: {
	taskKey: string;
	phase: string;
	prompt: string;
	skillContent: string;
	cli: string;
	model: string;
	flags?: string[];
}): Promise<void> {
	const runDir = getRunDir(options.taskKey);
	const manifest = await readManifest(options.taskKey);
	const promptPath = join(runDir, `${options.phase}.prompt.md`);
	const entry: ManifestPhase = {
		phase: options.phase,
		prompt_path: basename(promptPath),
		prompt_sha256: sha256(options.prompt),
		skill_sha256: sha256(options.skillContent),
		model: options.model,
		cli: options.cli,
		flags: options.flags ?? [],
		created_at: new Date().toISOString(),
	};
	manifest.updated_at = entry.created_at;
	manifest.phases = [...manifest.phases.filter((p) => p.phase !== options.phase), entry];
	await writeJson(join(runDir, 'manifest.json'), manifest);
}

export async function readManifest(taskKey: string): Promise<RunManifest> {
	const path = join(getRunDir(taskKey), 'manifest.json');
	if (existsSync(path)) {
		const manifest = await readJson<RunManifest>(path);
		if (manifest) return manifest;
	}
	const now = new Date().toISOString();
	return {
		version: 1,
		task_key: taskKey.toUpperCase(),
		created_at: now,
		updated_at: now,
		phases: [],
	};
}

export async function exportRunBundle(taskKey: string): Promise<string> {
	const runDir = getRunDir(taskKey);
	const files = await readdir(runDir);
	const bundle: { version: 1; task_key: string; files: Record<string, string> } = {
		version: 1,
		task_key: taskKey.toUpperCase(),
		files: {},
	};
	for (const file of files) {
		bundle.files[file] = await readFile(join(runDir, file), 'utf-8');
	}
	return JSON.stringify(bundle, null, 2);
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}
