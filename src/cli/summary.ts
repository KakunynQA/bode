import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRunDir } from '~/config/defaults.ts';
import type { RunMeta } from '~/storage/run-meta.ts';

const PHASE_FILES = ['planning', 'implementation', 'review'] as const;

/**
 * As of v0.18.0, bode does not shell out to git. The per-phase summary stops
 * printing `git diff --shortstat` — the user already saw the diff live in the
 * AI's interactive session.
 */
export async function printPhaseArtifacts(taskKey: string, phaseName: string): Promise<void> {
	const runDir = getRunDir(taskKey);
	const logPath = join(runDir, `${phaseName}.log`);
	const artifactPath = join(runDir, `${phaseName}.md`);

	const lines: string[] = [];
	if (existsSync(artifactPath)) {
		lines.push(`  Artifact: ${pc.cyan(artifactPath)}`);
	}
	if (existsSync(logPath)) {
		lines.push(`  Log:      ${pc.dim(logPath)}`);
	}

	if (lines.length > 0) {
		console.log(lines.join('\n'));
	}
}

export function printTaskSummary(meta: RunMeta): void {
	const runDir = getRunDir(meta.taskKey);
	const startMs = meta.startedAt;
	const endMs = meta.updatedAt;
	const durationStr = formatDuration(endMs - startMs);

	console.log('');
	console.log(pc.bold(pc.green(`✓ Task ${meta.taskKey} complete`)) + pc.dim(`  (${durationStr})`));
	console.log(pc.dim('─'.repeat(60)));

	const rows: [string, string][] = [
		['Summary', meta.jiraSummary],
		['Status', meta.status],
	];

	if (meta.projectName) rows.push(['Project', meta.projectName]);
	if (meta.workdir) rows.push(['Workdir', meta.workdir]);
	if (meta.branch && meta.baseBranch) {
		rows.push(['Branch', `${meta.branch} → ${meta.baseBranch}`]);
	}
	if (meta.prUrl) rows.push(['PR', meta.prUrl]);
	if (meta.conflict) rows.push(['Conflict', 'YES — manual resolution required']);
	if (meta.error) rows.push(['Error', meta.error]);

	const pad = Math.max(...rows.map(([k]) => k.length));
	for (const [k, v] of rows) {
		console.log(`  ${k.padEnd(pad)}  ${v}`);
	}

	console.log('');
	console.log(pc.bold('  Artifacts'));
	let any = false;
	for (const phase of PHASE_FILES) {
		const md = join(runDir, `${phase}.md`);
		const log = join(runDir, `${phase}.log`);
		const hasMd = existsSync(md);
		const hasLog = existsSync(log);
		if (!hasMd && !hasLog) continue;
		any = true;
		console.log(`    ${pc.cyan(phase)}`);
		if (hasMd) console.log(`      artifact: ${md}`);
		if (hasLog) console.log(`      log:      ${pc.dim(log)}`);
	}
	if (!any) {
		console.log(pc.dim(`    (no artifacts found in ${runDir})`));
	}

	console.log('');
	console.log(pc.dim(`  Run directory: ${runDir}`));
	console.log('');
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}
