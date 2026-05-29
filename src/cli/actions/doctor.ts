import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { detectEnv } from '~/config/auto-detect.ts';
import { loadConfig } from '~/config/loader.ts';
import { getGlobalConfigPath, getRunsDir } from '~/config/defaults.ts';
import { listAdapterNames } from '~/adapters/cli/registry.ts';
import { getVersion } from '~/utils/version.ts';
import { writeText } from '~/utils/fs.ts';

const execFileAsync = promisify(execFile);

type CheckResult = {
	name: string;
	status: 'ok' | 'warn' | 'fail';
	detail: string;
};

type DoctorOptions = {
	report?: string | boolean;
};

function fmt(c: CheckResult): string {
	const symbol =
		c.status === 'ok' ? pc.green('✓') : c.status === 'warn' ? pc.yellow('⚠') : pc.red('✗');
	return `${symbol} ${pc.bold(c.name.padEnd(28))} ${c.detail}`;
}

async function checkNodeVersion(): Promise<CheckResult> {
	const v = process.versions.node;
	const major = parseInt(v.split('.')[0] ?? '0', 10);
	if (major >= 20) {
		return { name: 'Node.js', status: 'ok', detail: `v${v}` };
	}
	return {
		name: 'Node.js',
		status: 'fail',
		detail: `v${v} — bode requires Node >=20`,
	};
}

async function checkBinaryAvailable(name: string, binary: string): Promise<CheckResult> {
	const isWindows = process.platform === 'win32';
	try {
		const { stdout } = await execFileAsync(binary, ['--version']);
		const version = stdout.trim().split('\n')[0] ?? '';
		return { name, status: 'ok', detail: version || 'installed' };
	} catch {
		try {
			await execFileAsync(isWindows ? 'where' : 'which', [binary]);
			return { name, status: 'ok', detail: 'installed (no --version)' };
		} catch {
			return { name, status: 'warn', detail: `${binary} not found on PATH` };
		}
	}
}

async function checkGlobalConfig(): Promise<CheckResult> {
	const path = getGlobalConfigPath();
	if (!existsSync(path)) {
		return {
			name: 'Global config',
			status: 'warn',
			detail: `${path} not found — run "bode setup" or rely on auto-detect`,
		};
	}
	const result = await loadConfig();
	if (!result.ok) {
		return {
			name: 'Global config',
			status: 'fail',
			detail: `${path} present but invalid: ${result.error.message}`,
		};
	}
	return { name: 'Global config', status: 'ok', detail: path };
}

async function checkRunsDir(): Promise<CheckResult> {
	const dir = getRunsDir();
	if (!existsSync(dir)) {
		return {
			name: 'Runs directory',
			status: 'warn',
			detail: `${dir} (will be created on first run)`,
		};
	}
	return { name: 'Runs directory', status: 'ok', detail: dir };
}

async function checkWindowsShell(): Promise<CheckResult> {
	if (process.platform !== 'win32') {
		return { name: 'Windows shell', status: 'ok', detail: 'not Windows' };
	}
	const shell = process.env.ComSpec ?? process.env.SHELL ?? 'unknown';
	return { name: 'Windows shell', status: 'ok', detail: shell };
}

async function checkWindowsPath(): Promise<CheckResult> {
	if (process.platform !== 'win32') {
		return { name: 'Windows PATH', status: 'ok', detail: 'not Windows' };
	}
	return process.env.PATH?.trim()
		? { name: 'Windows PATH', status: 'ok', detail: 'PATH inherited by this shell' }
		: { name: 'Windows PATH', status: 'warn', detail: 'PATH is empty in this shell' };
}

async function checkNpmWindowsSymlink(): Promise<CheckResult> {
	if (process.platform !== 'win32') {
		return { name: 'npm Windows symlinks', status: 'ok', detail: 'not Windows' };
	}
	try {
		const { stdout } = await execFileAsync('npm', ['--version']);
		const version = stdout.trim();
		const major = parseInt(version.split('.')[0] ?? '0', 10);
		return {
			name: 'npm Windows symlinks',
			status: major >= 11 ? 'warn' : 'ok',
			detail:
				major >= 11
					? `npm ${version}; global installs may hit Windows symlink quirks`
					: `npm ${version}`,
		};
	} catch {
		return { name: 'npm Windows symlinks', status: 'warn', detail: 'npm not found on PATH' };
	}
}

export async function doctorAction(options: DoctorOptions = {}): Promise<void> {
	const workdir = process.cwd();
	console.log('');
	console.log(pc.bold(`bode doctor`) + pc.dim(`  v${getVersion()}`));
	console.log(pc.dim('─'.repeat(64)));

	const checks: CheckResult[] = [];

	checks.push(await checkNodeVersion());
	checks.push(await checkGlobalConfig());
	checks.push(await checkRunsDir());
	checks.push(await checkWindowsShell());
	checks.push(await checkWindowsPath());
	checks.push(await checkNpmWindowsSymlink());

	// Env detection
	const env = await detectEnv(workdir, { globalConfigPath: getGlobalConfigPath() });

	checks.push({
		name: 'Workdir (cwd)',
		status: 'ok',
		detail: workdir,
	});

	if (env.gitRemoteUrl) {
		const provider = env.vcsProvider ?? 'unknown';
		checks.push({
			name: 'Git remote',
			status: env.vcsProvider ? 'ok' : 'warn',
			detail: `${env.gitRemoteUrl}  ${pc.dim(`(${provider})`)}`,
		});
	} else {
		checks.push({
			name: 'Git remote',
			status: 'warn',
			detail: 'CWD is not a git repo or has no origin',
		});
	}

	checks.push({
		name: '.bode.yml (repo)',
		status: env.hasRepoConfig ? 'ok' : 'warn',
		detail: env.hasRepoConfig ? 'present' : 'not found (optional)',
	});

	checks.push({
		name: 'Context files',
		status: env.contextFiles.length > 0 ? 'ok' : 'warn',
		detail: env.contextFiles.length > 0 ? env.contextFiles.join(', ') : 'no AGENTS.md or CLAUDE.md',
	});

	// AI CLIs
	const aiBinaries = [
		{ name: 'claude (Claude Code)', binary: 'claude' },
		{ name: 'opencode', binary: 'opencode' },
		{ name: 'codex', binary: 'codex' },
	];
	const aiResults = await Promise.all(
		aiBinaries.map((b) => checkBinaryAvailable(b.name, b.binary))
	);
	const anyAi = aiResults.some((r) => r.status === 'ok');
	if (!anyAi) {
		checks.push({
			name: 'AI CLI',
			status: 'fail',
			detail: 'No AI CLI found. Install one of: claude, opencode, codex',
		});
	}
	for (const r of aiResults) checks.push(r);

	// VCS CLIs
	checks.push(await checkBinaryAvailable('gh (GitHub CLI)', 'gh'));
	checks.push(await checkBinaryAvailable('glab (GitLab CLI)', 'glab'));

	// Adapter registry
	checks.push({
		name: 'CLI adapters',
		status: 'ok',
		detail: listAdapterNames().join(', '),
	});

	for (const c of checks) console.log(fmt(c));

	if (options.report) {
		const target = typeof options.report === 'string' ? options.report : 'bode-doctor-report.md';
		await writeText(target, buildReport(checks, workdir));
		console.log(pc.dim(`Report: ${target}`));
	}

	const fails = checks.filter((c) => c.status === 'fail').length;
	const warns = checks.filter((c) => c.status === 'warn').length;

	console.log(pc.dim('─'.repeat(64)));
	if (fails === 0 && warns === 0) {
		console.log(pc.green(`All ${checks.length} checks passed.`));
		process.exit(0);
	}
	if (fails === 0) {
		console.log(pc.yellow(`${warns} warning(s), no failures.`));
		process.exit(0);
	}
	console.log(pc.red(`${fails} failure(s), ${warns} warning(s).`));
	process.exit(1);
}

function buildReport(checks: CheckResult[], workdir: string): string {
	const rows = checks
		.map((check) => `| ${check.name} | ${check.status.toUpperCase()} | ${redact(check.detail)} |`)
		.join('\n');
	return [
		`# Bode Doctor Report`,
		'',
		`Generated: ${new Date().toISOString()}`,
		`Bode version: ${getVersion()}`,
		`OS: ${process.platform} ${process.arch}`,
		`Workdir: ${redact(workdir)}`,
		'',
		'No data was sent anywhere. Review and redact this file before sharing.',
		'',
		'| Check | Status | Detail |',
		'|---|---|---|',
		rows,
		'',
	].join('\n');
}

function redact(value: string): string {
	return value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>');
}
