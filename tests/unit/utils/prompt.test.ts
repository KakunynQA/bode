import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BackError, BACK } from '~/utils/prompt.ts';

describe('BackError', () => {
	it('is an Error subclass with name "BackError"', () => {
		const err = new BackError();
		assert.ok(err instanceof Error);
		assert.equal(err.name, 'BackError');
		assert.equal(err.message, '__BACK__');
	});
});

describe('BACK sentinel', () => {
	it('is a unique symbol', () => {
		assert.equal(typeof BACK, 'symbol');
		// Different runtime imports should resolve to the same instance.
		const same = BACK === BACK;
		assert.equal(same, true);
	});
});
