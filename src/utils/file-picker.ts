import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

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
	'.local',
	'.bode',
	'__pycache__',
	'.venv',
	'vendor',
	'target',
]);

const MAX_DEPTH = 6;
const MAX_RESULTS = 50;
const MAX_SCANNED = 5000;

/**
 * Walks `workdir` (skipping the ignore set) and returns relative paths matching
 * the optional fuzzy query. Used by the `@`-trigger file picker in
 * `bode setup-project` to feed candidates to `@inquirer/search`.
 *
 * - Empty/undefined query returns the first MAX_RESULTS files in deterministic
 *   directory-first order.
 * - Non-empty query ranks by:
 *     1. exact match (highest)
 *     2. prefix match on basename
 *     3. substring match on basename
 *     4. substring match anywhere
 *     5. subsequence match
 *   Ties broken by shorter path first, then alphabetical.
 */
export async function scanWorkdirFiles(workdir: string, query?: string): Promise<string[]> {
	const collected: string[] = [];
	let scanned = 0;

	async function walk(dir: string, depth: number): Promise<void> {
		if (depth > MAX_DEPTH || scanned >= MAX_SCANNED) return;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		entries.sort((a, b) => {
			if (a.isDirectory() && !b.isDirectory()) return -1;
			if (!a.isDirectory() && b.isDirectory()) return 1;
			return a.name.localeCompare(b.name);
		});
		for (const entry of entries) {
			if (scanned >= MAX_SCANNED) return;
			if (IGNORED_DIRS.has(entry.name)) continue;
			if (entry.name.startsWith('.') && entry.name !== '.cursorrules' && depth > 0) continue;
			const full = join(dir, entry.name);
			scanned++;
			if (entry.isDirectory()) {
				await walk(full, depth + 1);
			} else {
				const rel = relative(workdir, full).split(sep).join('/');
				collected.push(rel);
			}
		}
	}

	await walk(workdir, 0);

	const q = query?.trim().toLowerCase();
	if (!q) return collected.slice(0, MAX_RESULTS);

	const scored = collected
		.map((path) => ({ path, score: scorePath(path.toLowerCase(), q) }))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			if (a.path.length !== b.path.length) return a.path.length - b.path.length;
			return a.path.localeCompare(b.path);
		});

	return scored.slice(0, MAX_RESULTS).map((entry) => entry.path);
}

function scorePath(pathLower: string, query: string): number {
	const basename = pathLower.split('/').pop() ?? pathLower;
	if (basename === query) return 1000;
	if (basename.startsWith(query)) return 800;
	if (basename.includes(query)) return 600;
	if (pathLower.includes(query)) return 400;
	if (isSubsequence(query, pathLower)) return 200;
	return 0;
}

function isSubsequence(needle: string, haystack: string): boolean {
	let i = 0;
	for (const ch of haystack) {
		if (ch === needle[i]) i++;
		if (i === needle.length) return true;
	}
	return i === needle.length;
}

export const __testing = { scorePath, isSubsequence };
