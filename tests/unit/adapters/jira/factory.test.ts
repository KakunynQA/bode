import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createJiraAdapter } from '~/adapters/jira/factory.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';
import { RealJiraAdapter } from '~/adapters/jira/rest.ts';

describe('createJiraAdapter', () => {
	it('returns Mock when no email/token', () => {
		const adapter = createJiraAdapter({ site: 'x.atlassian.net' });
		assert.ok(adapter instanceof MockJiraAdapter);
	});
	it('returns Real when email + token present', () => {
		const adapter = createJiraAdapter({
			site: 'x.atlassian.net',
			email: 'a@b.com',
			api_token: 'tok',
		});
		assert.ok(adapter instanceof RealJiraAdapter);
	});
	it('returns Mock when only email present', () => {
		const adapter = createJiraAdapter({
			site: 'x.atlassian.net',
			email: 'a@b.com',
		});
		assert.ok(adapter instanceof MockJiraAdapter);
	});
});
