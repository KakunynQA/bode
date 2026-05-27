import type { IssueTrackerStrategy } from '~/types/issue-tracker.ts';
import { LocalTrackerAdapter } from './local.ts';
import { RealJiraAdapter } from '~/adapters/jira/rest.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';

export type TrackerSelection = {
	/** Active tracker kind. Useful for logging and `bode doctor`. */
	kind: 'jira' | 'local' | 'mock';
	adapter: IssueTrackerStrategy;
};

export type SelectTrackerOptions = {
	jira?:
		| {
				site?: string | undefined;
				email?: string | undefined;
				api_token?: string | undefined;
		  }
		| undefined;
	workdir: string;
	/** Force a specific tracker kind. Useful for tests. */
	force?: 'jira' | 'local' | 'mock' | undefined;
};

/**
 * Selects the right tracker for the current invocation.
 *
 * Order:
 *   1. If `force` is set, use it.
 *   2. If Jira is fully configured (site + email + token) → RealJiraAdapter.
 *   3. Otherwise → LocalTrackerAdapter (reads/writes .bode/tasks/<key>.md).
 *
 * The legacy `MockJiraAdapter` is no longer returned by default — its behavior
 * (in-memory issues with seeded data) was only useful in tests. Local is now
 * the real fallback for users without external trackers configured.
 */
export function selectTracker(options: SelectTrackerOptions): TrackerSelection {
	if (options.force) {
		switch (options.force) {
			case 'jira':
				if (options.jira?.email && options.jira?.api_token && options.jira?.site) {
					return {
						kind: 'jira',
						adapter: new RealJiraAdapter(
							options.jira.site,
							options.jira.email,
							options.jira.api_token
						),
					};
				}
				return { kind: 'mock', adapter: new MockJiraAdapter() };
			case 'mock':
				return { kind: 'mock', adapter: new MockJiraAdapter() };
			case 'local':
				return { kind: 'local', adapter: new LocalTrackerAdapter(options.workdir) };
		}
	}

	if (options.jira?.site && options.jira?.email && options.jira?.api_token) {
		return {
			kind: 'jira',
			adapter: new RealJiraAdapter(options.jira.site, options.jira.email, options.jira.api_token),
		};
	}

	return { kind: 'local', adapter: new LocalTrackerAdapter(options.workdir) };
}
