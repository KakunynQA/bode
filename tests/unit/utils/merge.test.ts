import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deepMerge } from '~/utils/merge.ts';

describe('deepMerge', () => {
	it('merges flat objects', () => {
		const merged = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
		assert.deepEqual(merged, { a: 1, b: 3, c: 4 });
	});

	it('merges nested objects recursively', () => {
		const merged = deepMerge({ outer: { a: 1, b: 2 } }, { outer: { b: 99, c: 3 } });
		assert.deepEqual(merged, { outer: { a: 1, b: 99, c: 3 } });
	});

	it('replaces arrays instead of element-merging (B6)', () => {
		const merged = deepMerge({ paths: ['a', 'b', 'c'] }, { paths: ['x'] });
		assert.deepEqual(merged, { paths: ['x'] });
	});

	it('replaces array even when target is shorter', () => {
		const merged = deepMerge({ paths: ['a'] }, { paths: ['x', 'y', 'z'] });
		assert.deepEqual(merged, { paths: ['x', 'y', 'z'] });
	});

	it('source array replaces object target', () => {
		const merged = deepMerge({ x: { a: 1 } }, { x: [1, 2, 3] });
		assert.deepEqual(merged, { x: [1, 2, 3] });
	});

	it('source object replaces array target', () => {
		const merged = deepMerge({ x: [1, 2] }, { x: { a: 1 } });
		assert.deepEqual(merged, { x: { a: 1 } });
	});

	it('primitives in source win', () => {
		const merged = deepMerge({ a: 1 }, { a: null });
		assert.deepEqual(merged, { a: null });
	});

	it('returns source when target is not an object', () => {
		assert.deepEqual(deepMerge(null, { a: 1 }), { a: 1 });
		assert.deepEqual(deepMerge(undefined, { a: 1 }), { a: 1 });
		assert.equal(deepMerge('foo', 'bar'), 'bar');
	});
});
