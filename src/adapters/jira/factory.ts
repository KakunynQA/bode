import type { JiraAdapter } from '~/types/jira.ts';
import { selectTracker } from '~/adapters/tracker/factory.ts';

/**
 * @deprecated since v0.21.0 — use `selectTracker` from
 * `~/adapters/tracker/factory.ts`. This shim preserves the old call sites
 * during the migration window. When `config.email` + `config.api_token` are
 * set, returns RealJiraAdapter as before. Otherwise returns
 * LocalTrackerAdapter (was: MockJiraAdapter in v0.20.x and earlier).
 *
 * The signature is unchanged. Behavior is mostly unchanged — the only
 * difference is the unconfigured fallback now writes/reads actual files in
 * `.bode/tasks/` instead of being an in-memory mock that vanishes on exit.
 *
 * Slated for removal in v0.23.0+. Migrate to `selectTracker({ jira, workdir })`.
 */
export function createJiraAdapter(config: {
	site?: string | undefined;
	email?: string | undefined;
	api_token?: string | undefined;
}): JiraAdapter {
	const jira: {
		site?: string | undefined;
		email?: string | undefined;
		api_token?: string | undefined;
	} = {};
	if (config.site !== undefined) jira.site = config.site;
	if (config.email !== undefined) jira.email = config.email;
	if (config.api_token !== undefined) jira.api_token = config.api_token;
	return selectTracker({ jira, workdir: process.cwd() }).adapter;
}
