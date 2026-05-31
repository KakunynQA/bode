import { existsSync } from 'node:fs';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getGlobalDir } from '~/config/defaults.ts';

export const HISTORY_MAX = 250;

function defaultHistoryPath(): string {
	return join(getGlobalDir(), 'history');
}

/**
 * Reads the persisted command history from `~/.bode/history`. Returns the
 * lines in chronological order — oldest first, newest last. A missing or
 * unreadable file is treated as empty history (no error). Malformed lines
 * (empty / whitespace-only) are dropped silently.
 */
export async function loadHistory(path = defaultHistoryPath()): Promise<string[]> {
	if (!existsSync(path)) return [];
	try {
		const text = await readFile(path, 'utf8');
		return text
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * Appends a single command to the persisted history.
 *
 * Contract:
 * - Empty / whitespace-only input is a no-op.
 * - If the new line equals the most-recent entry, it is collapsed (no
 *   duplicate consecutive lines, bash-style HISTCONTROL=ignoredups).
 * - The file is trimmed to the most recent `HISTORY_MAX` entries on every
 *   write.
 * - Writes go through a tmp-file + rename so a crash mid-write cannot
 *   leave a half-written history file. No locking — concurrent shells
 *   are last-writer-wins, which is acceptable for this use case.
 */
export async function appendHistory(line: string, path = defaultHistoryPath()): Promise<void> {
	const trimmed = line.trim();
	if (!trimmed) return;
	const current = await loadHistory(path);
	if (current[current.length - 1] === trimmed) return;
	const next = [...current, trimmed].slice(-HISTORY_MAX);
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	await writeFile(tmp, next.join('\n') + '\n', 'utf8');
	await rename(tmp, path);
}

export const __testing = { defaultHistoryPath };
