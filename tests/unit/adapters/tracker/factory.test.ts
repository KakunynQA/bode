import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectTracker } from '~/adapters/tracker/factory.ts';
import { LocalTrackerAdapter } from '~/adapters/tracker/local.ts';
import { GitHubIssuesAdapter } from '~/adapters/tracker/github-issues.ts';
import { RealJiraAdapter } from '~/adapters/jira/rest.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';

describe('selectTracker', () => {
	it('returns Jira when site + email + token are all present', () => {
		const sel = selectTracker({
			jira: { site: 'x.atlassian.net', email: 'a@b.com', api_token: 'tok' },
			workdir: '/tmp',
		});
		assert.equal(sel.kind, 'jira');
		assert.ok(sel.adapter instanceof RealJiraAdapter);
	});

	it('falls back to LocalTracker when Jira is partially configured', () => {
		const sel = selectTracker({
			jira: { site: 'x.atlassian.net', email: 'a@b.com' /* no token */ },
			workdir: '/tmp',
		});
		assert.equal(sel.kind, 'local');
		assert.ok(sel.adapter instanceof LocalTrackerAdapter);
	});

	it('falls back to LocalTracker when jira is undefined', () => {
		const sel = selectTracker({ workdir: '/tmp' });
		assert.equal(sel.kind, 'local');
		assert.ok(sel.adapter instanceof LocalTrackerAdapter);
	});

	it('force: "mock" returns MockJiraAdapter', () => {
		const sel = selectTracker({ workdir: '/tmp', force: 'mock' });
		assert.equal(sel.kind, 'mock');
		assert.ok(sel.adapter instanceof MockJiraAdapter);
	});

	it('force: "local" returns LocalTrackerAdapter even with Jira config', () => {
		const sel = selectTracker({
			jira: { site: 'x.atlassian.net', email: 'a@b.com', api_token: 'tok' },
			workdir: '/tmp',
			force: 'local',
		});
		assert.equal(sel.kind, 'local');
	});

	it('explicit tracker: "github-issues" returns GitHubIssuesAdapter', () => {
		const sel = selectTracker({ workdir: '/tmp', tracker: 'github-issues' });
		assert.equal(sel.kind, 'github-issues');
		assert.ok(sel.adapter instanceof GitHubIssuesAdapter);
	});

	it('explicit tracker beats Jira config when both present', () => {
		const sel = selectTracker({
			jira: { site: 'x.atlassian.net', email: 'a@b.com', api_token: 'tok' },
			workdir: '/tmp',
			tracker: 'github-issues',
		});
		assert.equal(sel.kind, 'github-issues');
	});

	it('explicit tracker: "jira" with partial creds falls through to mock', () => {
		const sel = selectTracker({
			jira: { site: 'x.atlassian.net' },
			workdir: '/tmp',
			tracker: 'jira',
		});
		assert.equal(sel.kind, 'mock');
	});

	it('plain-markdown is an alias for local', () => {
		const sel = selectTracker({ workdir: '/tmp', tracker: 'plain-markdown' });
		assert.equal(sel.kind, 'local');
		assert.ok(sel.adapter instanceof LocalTrackerAdapter);
	});

	it('linear requires an api key (throws otherwise)', () => {
		const prevEnv = process.env['LINEAR_API_KEY'];
		delete process.env['LINEAR_API_KEY'];
		try {
			assert.throws(
				() => selectTracker({ workdir: '/tmp', tracker: 'linear' }),
				/Linear tracker selected but no API key/
			);
		} finally {
			if (prevEnv !== undefined) process.env['LINEAR_API_KEY'] = prevEnv;
		}
	});

	it('linear resolves api key from config', () => {
		const sel = selectTracker({
			workdir: '/tmp',
			tracker: 'linear',
			linear: { api_key: 'lin_api_xxx' },
		});
		assert.equal(sel.kind, 'linear');
	});

	it('notion requires token + database_id', () => {
		const prevToken = process.env['NOTION_TOKEN'];
		const prevDb = process.env['NOTION_DATABASE_ID'];
		delete process.env['NOTION_TOKEN'];
		delete process.env['NOTION_DATABASE_ID'];
		try {
			assert.throws(
				() => selectTracker({ workdir: '/tmp', tracker: 'notion' }),
				/Notion tracker selected but missing config/
			);
		} finally {
			if (prevToken !== undefined) process.env['NOTION_TOKEN'] = prevToken;
			if (prevDb !== undefined) process.env['NOTION_DATABASE_ID'] = prevDb;
		}
	});

	it('notion resolves from config', () => {
		const sel = selectTracker({
			workdir: '/tmp',
			tracker: 'notion',
			notion: { api_token: 'ntn_xxx', database_id: 'abc123' },
		});
		assert.equal(sel.kind, 'notion');
	});

	it('trello requires both key and token', () => {
		const prevK = process.env['TRELLO_KEY'];
		const prevT = process.env['TRELLO_TOKEN'];
		delete process.env['TRELLO_KEY'];
		delete process.env['TRELLO_TOKEN'];
		try {
			assert.throws(
				() => selectTracker({ workdir: '/tmp', tracker: 'trello' }),
				/Trello tracker selected but missing credentials/
			);
		} finally {
			if (prevK !== undefined) process.env['TRELLO_KEY'] = prevK;
			if (prevT !== undefined) process.env['TRELLO_TOKEN'] = prevT;
		}
	});

	it('trello resolves from config', () => {
		const sel = selectTracker({
			workdir: '/tmp',
			tracker: 'trello',
			trello: { api_key: 'k', token: 't' },
		});
		assert.equal(sel.kind, 'trello');
	});
});
