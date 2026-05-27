import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { ProjectConfig } from '~/config/schema.ts';
import type { Result } from '~/types/result.ts';

export type PreflightIssue = {
	path: string;
	source: 'workdir' | 'context_paths' | 'repos';
	reason: 'missing' | 'no-read';
};

export type PreflightError = {
	message: string;
	issues: PreflightIssue[];
};

function resolveTarget(workdir: string, candidate: string): string {
	return isAbsolute(candidate) ? candidate : join(workdir, candidate);
}

async function checkReadable(path: string): Promise<'ok' | 'missing' | 'no-read'> {
	try {
		await access(path, constants.R_OK);
		return 'ok';
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		return code === 'ENOENT' ? 'missing' : 'no-read';
	}
}

export async function preflightProjectPaths(
	projectConfig: ProjectConfig
): Promise<Result<void, PreflightError>> {
	const issues: PreflightIssue[] = [];
	const seen = new Set<string>();

	type Target = { path: string; source: PreflightIssue['source'] };
	const targets: Target[] = [{ path: projectConfig.workdir, source: 'workdir' }];

	for (const p of projectConfig.context_paths ?? []) {
		targets.push({ path: resolveTarget(projectConfig.workdir, p), source: 'context_paths' });
	}
	for (const r of projectConfig.repos ?? []) {
		targets.push({ path: r.workdir, source: 'repos' });
	}

	for (const t of targets) {
		if (seen.has(t.path)) continue;
		seen.add(t.path);
		const result = await checkReadable(t.path);
		if (result !== 'ok') {
			issues.push({ path: t.path, source: t.source, reason: result });
		}
	}

	if (issues.length === 0) return { ok: true, value: undefined };

	const lines = issues.map((i) => `  - [${i.source}] ${i.path} (${i.reason})`);
	const message = `Preflight failed: ${issues.length} path(s) unreachable\n${lines.join('\n')}\n\nFix permissions or remove the path from your project config, then retry.`;

	return { ok: false, error: { message, issues } };
}
