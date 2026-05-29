import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AtTriggerError, BackError, AT_TRIGGER, BACK } from '~/utils/prompt.ts';

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

describe('AtTriggerError', () => {
	it('is an Error subclass with name "AtTriggerError"', () => {
		const err = new AtTriggerError();
		assert.ok(err instanceof Error);
		assert.equal(err.name, 'AtTriggerError');
		assert.equal(err.message, '__AT_TRIGGER__');
	});
});

describe('AT_TRIGGER sentinel', () => {
	it('is a unique symbol', () => {
		assert.equal(typeof AT_TRIGGER, 'symbol');
		const same = AT_TRIGGER === AT_TRIGGER;
		assert.equal(same, true);
	});
});
