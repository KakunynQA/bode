import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getModelsForCli, getAllCliModelEntries } from '~/adapters/cli/models.ts';

describe('getModelsForCli', () => {
	it('returns non-empty array for claude-code with known model', () => {
		const models = getModelsForCli('claude-code');
		assert.ok(models.length > 0);
		assert.ok(models.includes('claude-opus-4-7'));
	});

	it('returns non-empty array for opencode', () => {
		const models = getModelsForCli('opencode');
		assert.ok(models.length > 0);
	});

	it('returns non-empty array for codex', () => {
		const models = getModelsForCli('codex');
		assert.ok(models.length > 0);
	});

	it('returns empty array for nonexistent cli', () => {
		const models = getModelsForCli('nonexistent');
		assert.deepStrictEqual(models, []);
	});

	it('returns empty array for empty string', () => {
		const models = getModelsForCli('');
		assert.deepStrictEqual(models, []);
	});
});

describe('getAllCliModelEntries', () => {
	it('returns array with 3 entries', () => {
		const entries = getAllCliModelEntries();
		assert.equal(entries.length, 3);
	});

	it('each entry has name and models properties', () => {
		const entries = getAllCliModelEntries();
		for (const entry of entries) {
			assert.ok('name' in entry);
			assert.ok('models' in entry);
		}
	});

	it('has no duplicate CLI names', () => {
		const entries = getAllCliModelEntries();
		const names = entries.map((e) => e.name);
		assert.equal(names.length, new Set(names).size);
	});

	it('all models are non-empty strings', () => {
		const entries = getAllCliModelEntries();
		for (const entry of entries) {
			for (const model of entry.models) {
				assert.ok(typeof model === 'string' && model.length > 0);
			}
		}
	});
});
