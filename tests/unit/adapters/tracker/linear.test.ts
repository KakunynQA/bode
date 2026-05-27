import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LinearAdapter } from '~/adapters/tracker/linear.ts';

describe('LinearAdapter — construct + interface conformance', () => {
	it('constructs with an api key', () => {
		const adapter = new LinearAdapter({ apiKey: 'lin_api_xxx' });
		assert.ok(adapter);
	});

	it('implements all canonical IssueTrackerStrategy methods', () => {
		const adapter = new LinearAdapter({ apiKey: 'lin_api_xxx' });
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
		const adapter = new LinearAdapter({ apiKey: 'lin_api_xxx' });
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
		const adapter = new LinearAdapter({ apiKey: 'lin_api_xxx' });
		const r = await adapter.setStatus('ENG-1', '');
		assert.ok(r.ok);
	});

	it('attachFile is a no-op success', async () => {
		const adapter = new LinearAdapter({ apiKey: 'lin_api_xxx' });
		const r = await adapter.attachFile();
		assert.ok(r.ok);
	});
});
