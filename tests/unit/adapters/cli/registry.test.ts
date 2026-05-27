import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAdapter, listAdapterNames } from '~/adapters/cli/registry.ts';

describe('CLI adapter registry', () => {
	it('lists 3 default adapters (claude-code, opencode, codex)', () => {
		const names = listAdapterNames();
		assert.ok(names.includes('claude-code'));
		assert.ok(names.includes('opencode'));
		assert.ok(names.includes('codex'));
		assert.ok(!names.includes('zai'), 'zai adapter was removed in v0.14.0');
	});

	it('returns adapter for a known name', () => {
		const result = getAdapter('claude-code');
		assert.ok(result.ok);
		assert.equal(result.value.name, 'claude-code');
	});

	it('returns error for unknown adapter with helpful message', () => {
		const result = getAdapter('nonexistent');
		assert.ok(!result.ok);
		assert.ok(result.error.message.includes('Available'));
	});
});
