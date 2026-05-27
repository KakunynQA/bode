import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { textToAdf, adfToText } from '~/adapters/jira/adf.ts';

describe('textToAdf', () => {
	it('wraps a single paragraph as ADF doc', () => {
		const doc = textToAdf('hello world');
		assert.equal(doc.type, 'doc');
		assert.equal(doc.version, 1);
		assert.equal(doc.content?.length, 1);
		assert.equal(doc.content?.[0]?.type, 'paragraph');
		assert.equal(doc.content?.[0]?.content?.[0]?.text, 'hello world');
	});

	it('splits on blank lines into multiple paragraphs', () => {
		const doc = textToAdf('one\n\ntwo\n\nthree');
		assert.equal(doc.content?.length, 3);
	});

	it('produces a valid empty doc for empty input', () => {
		const doc = textToAdf('');
		assert.equal(doc.type, 'doc');
		assert.equal(doc.content?.length, 1);
	});

	it('preserves single newlines inside a paragraph', () => {
		const doc = textToAdf('line1\nline2');
		assert.equal(doc.content?.length, 1);
		assert.equal(doc.content?.[0]?.content?.[0]?.text, 'line1\nline2');
	});
});

describe('adfToText', () => {
	it('extracts text from a paragraph node', () => {
		const adf = {
			type: 'doc',
			version: 1,
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'hello' }],
				},
			],
		};
		assert.ok(adfToText(adf).includes('hello'));
	});

	it('returns empty string for null/undefined', () => {
		assert.equal(adfToText(null), '');
		assert.equal(adfToText(undefined), '');
	});

	it('handles a plain string', () => {
		assert.equal(adfToText('hello'), 'hello');
	});

	it('joins multiple paragraphs', () => {
		const adf = {
			type: 'doc',
			version: 1,
			content: [
				{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
				{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
			],
		};
		const out = adfToText(adf);
		assert.ok(out.includes('one'));
		assert.ok(out.includes('two'));
	});

	it('roundtrips text → adf → text (single paragraph)', () => {
		const adf = textToAdf('roundtrip');
		assert.ok(adfToText(adf).includes('roundtrip'));
	});
});
