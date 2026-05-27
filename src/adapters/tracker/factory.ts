import type { IssueTrackerStrategy } from '~/types/issue-tracker.ts';
import { LocalTrackerAdapter } from './local.ts';
import { GitHubIssuesAdapter } from './github-issues.ts';
import { RealJiraAdapter } from '~/adapters/jira/rest.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';

export type TrackerKind = 'jira' | 'github-issues' | 'local' | 'mock';

export type TrackerSelection = {
	kind: TrackerKind;
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
	/**
	 * Explicit tracker kind from config (`tracker: github-issues` etc).
	 * Honored over auto-selection.
	 */
	tracker?: TrackerKind | undefined;
	/** Force a specific tracker kind. Useful for tests. */
	force?: TrackerKind | undefined;
};

/**
 * Selects the right tracker for the current invocation.
 *
 * Priority:
 *   1. `force` (test-only override)
 *   2. `tracker` from config (explicit user choice)
 *   3. Jira if fully configured (site + email + token)
 *   4. Local fallback (`.bode/tasks/<key>.md`)
 */
export function selectTracker(options: SelectTrackerOptions): TrackerSelection {
	const explicit = options.force ?? options.tracker;
	if (explicit) {
		return materialize(explicit, options);
	}

	if (options.jira?.site && options.jira?.email && options.jira?.api_token) {
		return materialize('jira', options);
	}

	return materialize('local', options);
}

function materialize(kind: TrackerKind, options: SelectTrackerOptions): TrackerSelection {
	switch (kind) {
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
			// Asked for jira but missing creds → fall through to mock so callers
			// don't blow up on partial config. They get a clear error on first call.
			return { kind: 'mock', adapter: new MockJiraAdapter() };
		case 'github-issues':
			return {
				kind: 'github-issues',
				adapter: new GitHubIssuesAdapter({ workdir: options.workdir }),
			};
		case 'mock':
			return { kind: 'mock', adapter: new MockJiraAdapter() };
		case 'local':
		default:
			return { kind: 'local', adapter: new LocalTrackerAdapter(options.workdir) };
	}
}
