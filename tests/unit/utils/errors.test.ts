import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	errorWithHint,
	errorChecklist,
	missingConfigError,
	unknownAdapterError,
} from '~/utils/errors.ts';

describe('errorWithHint', () => {
	it('formats with arrow + hint line', () => {
		const err = errorWithHint('Thing broke', 'Try fixing it');
		assert.ok(err.message.includes('Thing broke'));
		assert.ok(err.message.includes('→ Try fixing it'));
	});
});

describe('errorChecklist', () => {
	it('formats multiple items as bullets', () => {
		const err = errorChecklist('Multiple problems', ['First', 'Second']);
		assert.ok(err.message.includes('Multiple problems'));
		assert.ok(err.message.includes('- First'));
		assert.ok(err.message.includes('- Second'));
		assert.ok(err.message.includes('Checklist'));
	});
});

describe('missingConfigError', () => {
	it('names the missing key + suggestion', () => {
		const err = missingConfigError('jira.email', 'Run bode setup');
		assert.ok(err.message.includes('jira.email'));
		assert.ok(err.message.includes('Run bode setup'));
	});
});

describe('unknownAdapterError', () => {
	it('lists available adapters', () => {
		const err = unknownAdapterError('CLI', 'foo', ['claude-code', 'codex']);
		assert.ok(err.message.includes('foo'));
		assert.ok(err.message.includes('claude-code'));
		assert.ok(err.message.includes('codex'));
	});
});
