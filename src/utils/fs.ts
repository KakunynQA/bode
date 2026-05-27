import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

export async function ensureDir(path: string): Promise<void> {
	if (!existsSync(path)) {
		await mkdir(path, { recursive: true });
	}
}

/**
 * Atomically write JSON to a path. Writes to <path>.tmp first, then renames
 * over the destination. Rename is atomic on the same filesystem on all
 * supported platforms (POSIX + NTFS). Prevents corruption when bode is
 * interrupted (ctrl-C, crash, OS signal) mid-write — readers see either the
 * previous version or the new one, never a half-written file.
 *
 * Falls back to plain writeFile only if rename fails (e.g. cross-device).
 */
export async function writeJson<T>(path: string, data: T): Promise<void> {
	await ensureDir(dirname(path));
	const tmpPath = `${path}.tmp.${process.pid}.${Date.now()}`;
	const body = JSON.stringify(data, null, 2);
	try {
		await writeFile(tmpPath, body, 'utf-8');
		await rename(tmpPath, path);
	} catch (err) {
		// Try to clean up the temp file if it's still around.
		try {
			await unlink(tmpPath);
		} catch {
			/* ignore */
		}
		// As a last resort, do a non-atomic write so we don't lose the data.
		// Only rethrow if the fallback write also fails.
		try {
			await writeFile(path, body, 'utf-8');
		} catch {
			throw err;
		}
	}
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
