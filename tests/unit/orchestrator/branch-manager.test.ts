import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as bm from '~/orchestrator/branch-manager.ts';

describe('branch-manager module', () => {
	it('exports mergePR as a function', () => {
		assert.ok(typeof bm.mergePR === 'function');
	});

	it('mergePR with github provider returns a result', async () => {
		const result = await bm.mergePR(1, 'github');
		assert.ok('ok' in result);
	});

	it('mergePR with gitlab provider returns a result', async () => {
		const result = await bm.mergePR(1, 'gitlab');
		assert.ok('ok' in result);
	});
});
