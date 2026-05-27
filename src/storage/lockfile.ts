import { existsSync } from 'node:fs';
import { readFile, unlink, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { getRunDir } from '~/config/defaults.ts';
import type { Result } from '~/types/result.ts';

const LOCK_FILE = '.lock';

type LockInfo = {
	pid: number;
	host: string;
	startedAt: number;
	command: string;
};

/**
 * Returns whether a given pid is currently alive on this host. Uses
 * `process.kill(pid, 0)` which throws ESRCH for dead pids and EPERM for live
 * pids we don't own. Both EPERM and "no error" mean the process exists.
 */
function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		return code === 'EPERM';
	}
}

function lockPath(taskKey: string): string {
	return join(getRunDir(taskKey), LOCK_FILE);
}

async function readLock(taskKey: string): Promise<LockInfo | null> {
	const path = lockPath(taskKey);
	if (!existsSync(path)) return null;
	try {
		const raw = await readFile(path, 'utf-8');
		return JSON.parse(raw) as LockInfo;
	} catch {
		return null;
	}
}

/**
 * Try to acquire an exclusive lock on a task key. Returns:
 *   - { ok: true, value: ... } when the lock is ours
 *   - { ok: false, error } when another live process holds the lock
 *
 * Stale locks (lock file references a pid that's no longer running, OR was
 * written on a different host) are reclaimed automatically.
 */
export async function acquireLock(
	taskKey: string,
	command: string
): Promise<Result<{ release: () => Promise<void> }>> {
	const path = lockPath(taskKey);
	await mkdir(join(getRunDir(taskKey)), { recursive: true });

	const existing = await readLock(taskKey);
	if (existing) {
		const stale =
			existing.host !== hostname() || !isPidAlive(existing.pid) || existing.pid === process.pid;
		if (!stale) {
			const ageMin = Math.round((Date.now() - existing.startedAt) / 60000);
			return {
				ok: false,
				error: new Error(
					`Task ${taskKey} is locked by another bode process (pid ${existing.pid} on ${existing.host}, running "${existing.command}" for ~${ageMin} min).\n` +
						`  If you're sure that process is dead, delete ${path} manually and retry.`
				),
			};
		}
	}

	const info: LockInfo = {
		pid: process.pid,
		host: hostname(),
		startedAt: Date.now(),
		command,
	};
	await writeFile(path, JSON.stringify(info, null, 2), 'utf-8');

	const release = async (): Promise<void> => {
		try {
			const current = await readLock(taskKey);
			if (current && current.pid === process.pid && current.host === hostname()) {
				await unlink(path);
			}
		} catch {
			// best-effort
		}
	};

	return { ok: true, value: { release } };
}

/**
 * For tests / diagnostics — peek at the lock without trying to acquire.
 */
export async function inspectLock(taskKey: string): Promise<LockInfo | null> {
	return readLock(taskKey);
}
