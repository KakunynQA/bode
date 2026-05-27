import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

export async function ensureDir(path: string): Promise<void> {
	if (!existsSync(path)) {
		await mkdir(path, { recursive: true });
	}
}

export async function writeJson<T>(path: string, data: T): Promise<void> {
	await ensureDir(dirname(path));
	await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readJson<T>(path: string): Promise<T | null> {
	if (!existsSync(path)) return null;
	const raw = await readFile(path, 'utf-8');
	return JSON.parse(raw) as T;
}

export async function writeText(path: string, content: string): Promise<void> {
	await ensureDir(dirname(path));
	await writeFile(path, content, 'utf-8');
}

export async function readText(path: string): Promise<string | null> {
	if (!existsSync(path)) return null;
	return await readFile(path, 'utf-8');
}

export async function chmodSensitive(path: string): Promise<void> {
	if (process.platform === 'win32') return;
	try {
		await chmod(path, 0o600);
	} catch {
		// best-effort
	}
}
