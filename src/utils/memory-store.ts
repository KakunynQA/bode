import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { getMemoryDir } from '~/config/defaults.ts';

const MEMORY_FILES = ['notes.md', 'gotchas.md', 'style.md'] as const;
const MAX_MEMORY_BYTES = 4096;

export function memorySlug(projectPath: string): string {
	const hash = createHash('sha256').update(projectPath.toLowerCase()).digest('hex').slice(0, 12);
	return `${projectPath.split(/[\\/]/).filter(Boolean).pop() ?? 'project'}-${hash}`;
}

export function memoryDirForProject(projectPath: string): string {
	return join(getMemoryDir(), memorySlug(projectPath));
}

export async function initMemory(projectPath: string): Promise<string> {
	const dir = memoryDirForProject(projectPath);
	await mkdir(dir, { recursive: true });
	for (const file of MEMORY_FILES) {
		const path = join(dir, file);
		if (!existsSync(path)) await writeFile(path, `# ${file.replace('.md', '')}\n`, 'utf-8');
	}
	await writeFile(
		join(dir, 'metadata.json'),
		JSON.stringify(
			{ version: 1, project_path: projectPath, opted_in_at: new Date().toISOString() },
			null,
			2
		),
		'utf-8'
	);
	return dir;
}

export async function disableMemory(projectPath: string): Promise<void> {
	const dir = memoryDirForProject(projectPath);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, 'metadata.json'),
		JSON.stringify({ version: 1, project_path: projectPath, opted_in_at: null }, null, 2),
		'utf-8'
	);
}

export async function appendMemoryNote(projectPath: string, note: string): Promise<void> {
	const dir = await initMemory(projectPath);
	const path = join(dir, 'notes.md');
	const current = existsSync(path) ? await readFile(path, 'utf-8') : '';
	await writeFile(path, `${current.trim()}\n\n- ${new Date().toISOString()}: ${note}\n`, 'utf-8');
}

export async function readProjectMemory(projectPath: string): Promise<string | undefined> {
	const dir = memoryDirForProject(projectPath);
	const metaPath = join(dir, 'metadata.json');
	if (!existsSync(metaPath)) return undefined;
	try {
		const meta = JSON.parse(await readFile(metaPath, 'utf-8')) as { opted_in_at?: string | null };
		if (!meta.opted_in_at) return undefined;
	} catch {
		return undefined;
	}
	const parts: string[] = [];
	for (const file of MEMORY_FILES) {
		const path = join(dir, file);
		if (!existsSync(path)) continue;
		let content = await readFile(path, 'utf-8');
		if (Buffer.byteLength(content, 'utf-8') > MAX_MEMORY_BYTES) {
			content = `${content.slice(0, MAX_MEMORY_BYTES)}\n\n[truncated: prune this memory file]`;
		}
		parts.push(`### ${file}\n\n${content.trim()}`);
	}
	return parts.length > 0
		? `<project_memory>\n${parts.join('\n\n')}\n</project_memory>`
		: undefined;
}
