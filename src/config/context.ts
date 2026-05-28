import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectConfig } from '~/config/schema.ts';

const FILE_TREE_MAX_DEPTH = 4;
const FILE_TREE_MAX_ENTRIES = 200;

const IGNORED_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'.nuxt',
	'coverage',
	'.cache',
	'.turbo',
	'__pycache__',
	'.venv',
	'vendor',
	'target',
	'bin',
	'obj',
	'.idea',
	'.vscode',
	'.vs',
]);

const IGNORED_FILES = new Set([
	'.DS_Store',
	'Thumbs.db',
	'package-lock.json',
	'yarn.lock',
	'pnpm-lock.yaml',
	'bun.lockb',
	'.env',
	'.env.local',
	'.env.development.local',
	'.env.test.local',
	'.env.production.local',
]);

export async function gatherContext(
	projectConfig: ProjectConfig
): Promise<{ agentsMd: string | undefined; fileTree: string | undefined }> {
	const workdir = projectConfig.workdir;

	const agentsMd = await readAgentsMd(workdir, projectConfig.context_files);
	const learnedContext = await readLearnedContext(workdir);
	const fileTree = await generateFileTree(workdir, projectConfig.context_paths);

	return {
		agentsMd: [learnedContext, agentsMd].filter(Boolean).join('\n\n') || undefined,
		fileTree,
	};
}

async function readLearnedContext(workdir: string): Promise<string | undefined> {
	const fullPath = join(workdir, '.bode', 'context.md');
	if (!existsSync(fullPath)) return undefined;
	try {
		const content = await readFile(fullPath, 'utf-8');
		return content.trim() ? `### .bode/context.md\n\n${content.trim()}` : undefined;
	} catch {
		return undefined;
	}
}

async function readAgentsMd(
	workdir: string,
	contextFiles: string[] | undefined
): Promise<string | undefined> {
	const candidates = contextFiles ?? ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md'];
	const parts: string[] = [];

	for (const candidate of candidates) {
		const fullPath = join(workdir, candidate);
		if (existsSync(fullPath)) {
			try {
				const content = await readFile(fullPath, 'utf-8');
				if (content.trim()) {
					parts.push(`### ${candidate}\n\n${content.trim()}`);
				}
			} catch {
				// skip unreadable files
			}
		}
	}

	return parts.length > 0 ? parts.join('\n\n') : undefined;
}

async function generateFileTree(
	workdir: string,
	contextPaths: string[] | undefined
): Promise<string | undefined> {
	const paths = contextPaths ?? ['.'];
	const lines: string[] = [];
	let count = 0;

	for (const basePath of paths) {
		const fullBase = join(workdir, basePath);
		if (!existsSync(fullBase)) continue;

		await walkDir(fullBase, workdir, lines, 0, (ref) => {
			count = ref;
		});
		if (count >= FILE_TREE_MAX_ENTRIES) break;
	}

	return lines.length > 0 ? lines.join('\n') : undefined;
}

async function walkDir(
	dirPath: string,
	rootDir: string,
	lines: string[],
	depth: number,
	counter: (n: number) => void,
	prefix = ''
): Promise<void> {
	if (depth > FILE_TREE_MAX_DEPTH) return;

	let entries;
	try {
		entries = await readdir(dirPath, { withFileTypes: true });
	} catch {
		return;
	}

	entries.sort((a, b) => {
		if (a.isDirectory() && !b.isDirectory()) return -1;
		if (!a.isDirectory() && b.isDirectory()) return 1;
		return a.name.localeCompare(b.name);
	});

	let count = lines.length;
	for (const entry of entries) {
		if (count >= FILE_TREE_MAX_ENTRIES) break;
		if (entry.name.startsWith('.') && depth > 0) continue;
		if (IGNORED_DIRS.has(entry.name)) continue;
		if (IGNORED_FILES.has(entry.name)) continue;

		if (entry.isDirectory()) {
			lines.push(`${prefix}${entry.name}/`);
			await walkDir(join(dirPath, entry.name), rootDir, lines, depth + 1, counter, `${prefix}  `);
			count = lines.length;
			counter(count);
		} else {
			lines.push(`${prefix}${entry.name}`);
			count++;
			counter(count);
		}
	}
}

export async function validateWorkdir(workdir: string): Promise<Result<void>> {
	if (!existsSync(workdir)) {
		return { ok: false, error: new Error(`Workdir does not exist: ${workdir}`) };
	}
	const s = await stat(workdir);
	if (!s.isDirectory()) {
		return { ok: false, error: new Error(`Workdir is not a directory: ${workdir}`) };
	}
	return { ok: true, value: undefined };
}

type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
