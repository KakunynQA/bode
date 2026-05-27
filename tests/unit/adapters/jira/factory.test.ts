import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createJiraAdapter } from '~/adapters/jira/factory.ts';
import { LocalTrackerAdapter } from '~/adapters/tracker/local.ts';
import { RealJiraAdapter } from '~/adapters/jira/rest.ts';

describe('createJiraAdapter (legacy shim — v0.21.0+ delegates to selectTracker)', () => {
	it('returns LocalTracker when no email/token (was MockJiraAdapter pre-v0.21)', () => {
		const adapter = createJiraAdapter({ site: 'x.atlassian.net' });
		assert.ok(adapter instanceof LocalTrackerAdapter);
	});
	it('returns Real when site + email + token present', () => {
		const adapter = createJiraAdapter({
			site: 'x.atlassian.net',
			email: 'a@b.com',
			api_token: 'tok',
		});
		assert.ok(adapter instanceof RealJiraAdapter);
	});
	it('returns LocalTracker when only email present', () => {
		const adapter = createJiraAdapter({
			site: 'x.atlassian.net',
			email: 'a@b.com',
		});
		assert.ok(adapter instanceof LocalTrackerAdapter);
	});
});
