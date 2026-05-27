import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, prefixEmoji, truncate } from '~/utils/format.ts';

describe('formatDuration', () => {
	it('formats ms', () => {
		assert.equal(formatDuration(500), '500ms');
	});
	it('formats seconds', () => {
		assert.equal(formatDuration(2500), '2s');
	});
	it('formats minutes', () => {
		assert.equal(formatDuration(75 * 1000), '1m 15s');
	});
});

describe('prefixEmoji', () => {
	it('prepends robot emoji when enabled', () => {
		assert.ok(prefixEmoji('hi', true).startsWith('🤖 '));
	});
	it('returns text untouched when disabled', () => {
		assert.equal(prefixEmoji('hi', false), 'hi');
	});
});

describe('truncate', () => {
	it('returns text unchanged when under limit', () => {
		assert.equal(truncate('hi', 50), 'hi');
	});
	it('truncates with ellipsis when over limit', () => {
		const out = truncate('abcdefghij', 6);
		assert.equal(out.length, 6);
		assert.ok(out.endsWith('...'));
	});
});
