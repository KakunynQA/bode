import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectTracker } from '~/adapters/tracker/factory.ts';
import { LocalTrackerAdapter } from '~/adapters/tracker/local.ts';
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
});
