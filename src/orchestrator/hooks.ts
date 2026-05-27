import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pc from 'picocolors';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';

const execFileAsync = promisify(execFile);

/**
 * Plugin hook system (#27).
 *
 * Allows users to inject custom shell commands at well-known points in the
 * phase lifecycle. Configure via `hooks` in `~/.bode/config.yml` or
 * `.bode.yml`:
 *
 *   hooks:
 *     pre_implementation:
 *       - npm run lint:fix
 *     post_review:
 *       - ./.bode/hooks/notify-slack.sh
 *     pre_pr:
 *       - npm test
 *
 * Each hook entry is an array of shell command strings, executed sequentially
 * in the project workdir. A non-zero exit aborts the phase by default (set
 * `non_blocking: true` per hook to ignore failures).
 *
 * Environment variables provided to hooks:
 *   BODE_TASK_KEY     the task key
 *   BODE_PHASE        the phase name (planning/implementation/review/pr)
 *   BODE_HOOK         the hook name (pre_implementation, etc.)
 *   BODE_WORKDIR      absolute path to the project workdir
 *
 * The hook system is opt-in: bode does nothing when `hooks` is absent.
 */

export type HookPoint =
	| 'pre_planning'
	| 'post_planning'
	| 'pre_implementation'
	| 'post_implementation'
	| 'pre_review'
	| 'post_review'
	| 'pre_pr'
	| 'post_pr';

type HookEntry =
	| string
	| {
			run: string;
			non_blocking?: boolean | undefined;
	  };

export type HooksConfig = { [K in HookPoint]?: HookEntry[] | undefined };

export type HookContext = {
	taskKey: string;
	phase: string;
	workdir: string;
};

export type HookResult = { ok: true } | { ok: false; failedCommand: string; error: Error };

function resolveHooks(
	point: HookPoint,
	config: BodeConfig & { hooks?: HooksConfig | undefined },
	projectConfig?: ProjectConfig & { hooks?: HooksConfig | undefined }
): HookEntry[] {
	const fromProject = projectConfig?.hooks?.[point] ?? [];
	const fromGlobal = config.hooks?.[point] ?? [];
	return [...fromGlobal, ...fromProject];
}

export async function runHook(
	point: HookPoint,
	context: HookContext,
	config: BodeConfig & { hooks?: HooksConfig | undefined },
	projectConfig?: ProjectConfig & { hooks?: HooksConfig | undefined }
): Promise<HookResult> {
	const hooks = resolveHooks(point, config, projectConfig);
	if (hooks.length === 0) return { ok: true };

	console.log(pc.dim(`[hook ${point}] running ${hooks.length} command(s)...`));

	for (const entry of hooks) {
		const cmd = typeof entry === 'string' ? entry : entry.run;
		const nonBlocking = typeof entry === 'object' && entry.non_blocking === true;

		try {
			await execFileAsync('sh', ['-c', cmd], {
				cwd: context.workdir,
				env: {
					...process.env,
					BODE_TASK_KEY: context.taskKey,
					BODE_PHASE: context.phase,
					BODE_HOOK: point,
					BODE_WORKDIR: context.workdir,
				},
			});
			console.log(pc.dim(`  ✓ ${cmd}`));
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			if (nonBlocking) {
				console.warn(pc.yellow(`  ⚠ ${cmd}  (non-blocking, continuing)`));
				continue;
			}
			console.error(pc.red(`  ✗ ${cmd}`));
			return { ok: false, failedCommand: cmd, error };
		}
	}

	return { ok: true };
}

export const __testing = { resolveHooks };
