import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { memorySlug } from '~/utils/memory-store.ts';

describe('memorySlug', () => {
	it('is stable for the same path', () => {
		assert.equal(memorySlug('/tmp/project'), memorySlug('/tmp/project'));
	});

	it('contains a readable basename', () => {
		assert.match(memorySlug('/tmp/project'), /^project-/);
	});
});
