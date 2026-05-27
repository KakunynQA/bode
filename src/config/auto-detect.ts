import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { VcsProvider } from '~/types/vcs.ts';

const execFileAsync = promisify(execFile);

export type DetectedEnv = {
	/** Git remote URL when CWD is a git repo with origin configured. */
	gitRemoteUrl?: string;
	/** Provider inferred from the git remote URL. */
	vcsProvider?: VcsProvider;
	/** Org/repo extracted from the remote URL. */
	repoSlug?: { org: string; repo: string };
	/** First AI CLI binary found on PATH. */
	availableAiCli?: 'claude-code' | 'opencode' | 'codex';
	/** Project context files that exist in CWD. */
	contextFiles: string[];
	/** Whether `.bode.yml` exists in CWD. */
	hasRepoConfig: boolean;
	/** Whether `~/.bode/config.yml` exists. */
	hasGlobalConfig: boolean;
};

const AI_CLI_PROBES: Array<{ name: 'claude-code' | 'opencode' | 'codex'; binary: string }> = [
	{ name: 'claude-code', binary: 'claude' },
	{ name: 'opencode', binary: 'opencode' },
	{ name: 'codex', binary: 'codex' },
];

const CONTEXT_FILE_CANDIDATES = ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md', 'CONTRIBUTING.md'];

/**
 * Reads `git remote get-url origin` in the given workdir. This is the ONLY
 * place in bode that calls git directly post-v0.18.0, and it's read-only —
 * used for env detection at startup, not for any mutation.
 */
async function readGitRemote(workdir: string): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
			cwd: workdir,
		});
		return stdout.trim();
	} catch {
		return null;
	}
}

function inferProvider(remoteUrl: string): VcsProvider | null {
	if (/github\.com[:/]/.test(remoteUrl)) return 'github';
	if (/gitlab\.[^/]+[:/]/.test(remoteUrl)) return 'gitlab';
	return null;
}

function parseSlug(remoteUrl: string): { org: string; repo: string } | null {
	// git@host:org/repo.git or https://host/org/repo(.git)
	const ssh = remoteUrl.match(/^[^@]+@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/);
	if (ssh?.[1] && ssh[2]) return { org: ssh[1], repo: ssh[2] };
	const https = remoteUrl.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
	if (https?.[1] && https[2]) return { org: https[1], repo: https[2] };
	return null;
}

async function probeBinary(binary: string): Promise<boolean> {
	const isWindows = process.platform === 'win32';
	try {
		await execFileAsync(isWindows ? 'where' : 'which', [binary]);
		return true;
	} catch {
		return false;
	}
}

async function detectAvailableCli(): Promise<DetectedEnv['availableAiCli']> {
	for (const probe of AI_CLI_PROBES) {
		if (await probeBinary(probe.binary)) {
			return probe.name;
		}
	}
	return undefined;
}

function detectContextFiles(workdir: string): string[] {
	return CONTEXT_FILE_CANDIDATES.filter((rel) => existsSync(join(workdir, rel)));
}

export async function detectEnv(
	workdir: string,
	options: { globalConfigPath: string }
): Promise<DetectedEnv> {
	const gitRemoteUrl = (await readGitRemote(workdir)) ?? undefined;
	const vcsProvider = gitRemoteUrl ? (inferProvider(gitRemoteUrl) ?? undefined) : undefined;
	const repoSlug = gitRemoteUrl ? (parseSlug(gitRemoteUrl) ?? undefined) : undefined;
	const availableAiCli = await detectAvailableCli();
	const contextFiles = detectContextFiles(workdir);
	const hasRepoConfig = existsSync(join(workdir, '.bode.yml'));
	const hasGlobalConfig = existsSync(options.globalConfigPath);

	return {
		...(gitRemoteUrl ? { gitRemoteUrl } : {}),
		...(vcsProvider ? { vcsProvider } : {}),
		...(repoSlug ? { repoSlug } : {}),
		...(availableAiCli ? { availableAiCli } : {}),
		contextFiles,
		hasRepoConfig,
		hasGlobalConfig,
	};
}

export const __testing = { inferProvider, parseSlug };
