import type { IssueTrackerStrategy } from '~/types/issue-tracker.ts';
import { LocalTrackerAdapter } from './local.ts';
import { GitHubIssuesAdapter } from './github-issues.ts';
import { LinearAdapter } from './linear.ts';
import { NotionAdapter } from './notion.ts';
import { TrelloAdapter } from './trello.ts';
import { RealJiraAdapter } from '~/adapters/jira/rest.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';

export type TrackerKind =
	| 'jira'
	| 'github-issues'
	| 'linear'
	| 'notion'
	| 'trello'
	| 'local'
	| 'plain-markdown'
	| 'mock';

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
	linear?: { api_key?: string | undefined } | undefined;
	notion?:
		| {
				api_token?: string | undefined;
				database_id?: string | undefined;
				properties?:
					| { title?: string | undefined; status?: string | undefined; tags?: string | undefined }
					| undefined;
		  }
		| undefined;
	trello?:
		| {
				api_key?: string | undefined;
				token?: string | undefined;
				board_id?: string | undefined;
		  }
		| undefined;
	workdir: string;
	tracker?: TrackerKind | undefined;
	force?: TrackerKind | undefined;
};

/**
 * Tracker selection priority:
 *   1. `force` (test override)
 *   2. `tracker` from config (explicit user choice)
 *   3. Jira when fully configured (site + email + token)
 *   4. Local fallback
 *
 * `plain-markdown` is an alias for `local` (same backend, more accurate name
 * for users who don't think "local" describes a markdown file format).
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
			return { kind: 'mock', adapter: new MockJiraAdapter() };

		case 'github-issues':
			return {
				kind: 'github-issues',
				adapter: new GitHubIssuesAdapter({ workdir: options.workdir }),
			};

		case 'linear': {
			const apiKey = options.linear?.api_key ?? process.env['LINEAR_API_KEY'];
			if (!apiKey) {
				throw new Error(
					'Linear tracker selected but no API key found. Set linear.api_key in config or LINEAR_API_KEY env var.'
				);
			}
			return { kind: 'linear', adapter: new LinearAdapter({ apiKey }) };
		}

		case 'notion': {
			const apiToken = options.notion?.api_token ?? process.env['NOTION_TOKEN'];
			const databaseId = options.notion?.database_id ?? process.env['NOTION_DATABASE_ID'];
			if (!apiToken || !databaseId) {
				throw new Error(
					'Notion tracker selected but missing config. Set notion.api_token (or NOTION_TOKEN) and notion.database_id (or NOTION_DATABASE_ID).'
				);
			}
			return {
				kind: 'notion',
				adapter: new NotionAdapter({
					apiToken,
					databaseId,
					...(options.notion?.properties ? { properties: options.notion.properties } : {}),
				}),
			};
		}

		case 'trello': {
			const apiKey = options.trello?.api_key ?? process.env['TRELLO_KEY'];
			const token = options.trello?.token ?? process.env['TRELLO_TOKEN'];
			if (!apiKey || !token) {
				throw new Error(
					'Trello tracker selected but missing credentials. Set trello.api_key + trello.token in config, or TRELLO_KEY + TRELLO_TOKEN env vars.'
				);
			}
			return { kind: 'trello', adapter: new TrelloAdapter({ apiKey, token }) };
		}

		case 'mock':
			return { kind: 'mock', adapter: new MockJiraAdapter() };

		case 'plain-markdown':
		case 'local':
		default:
			return { kind: 'local', adapter: new LocalTrackerAdapter(options.workdir) };
	}
}
