import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrelloAdapter } from '~/adapters/tracker/trello.ts';

describe('TrelloAdapter — construct + interface conformance', () => {
	it('constructs with api key + token', () => {
		const adapter = new TrelloAdapter({ apiKey: 'k', token: 't' });
		assert.ok(adapter);
	});

	it('implements all canonical IssueTrackerStrategy methods', () => {
		const adapter = new TrelloAdapter({ apiKey: 'k', token: 't' });
		for (const m of [
			'fetchTask',
			'postComment',
			'setStatus',
			'addTag',
			'removeTag',
			'attachFile',
			'listStatuses',
		] as const) {
			assert.equal(typeof (adapter as Record<string, unknown>)[m], 'function', m);
		}
	});

	it('implements deprecated alias methods', () => {
		const adapter = new TrelloAdapter({ apiKey: 'k', token: 't' });
		for (const m of [
			'getIssue',
			'addComment',
			'transitionStatus',
			'addLabel',
			'removeLabel',
			'getTransitions',
		] as const) {
			assert.equal(typeof (adapter as Record<string, unknown>)[m], 'function', m);
		}
	});

	it('setStatus("") is a no-op success', async () => {
		const adapter = new TrelloAdapter({ apiKey: 'k', token: 't' });
		const r = await adapter.setStatus('cardId', '');
		assert.ok(r.ok);
	});

	it('attachFile is a no-op success', async () => {
		const adapter = new TrelloAdapter({ apiKey: 'k', token: 't' });
		const r = await adapter.attachFile();
		assert.ok(r.ok);
	});
});
