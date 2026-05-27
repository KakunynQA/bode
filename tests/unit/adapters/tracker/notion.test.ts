import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotionAdapter, __testing } from '~/adapters/tracker/notion.ts';

const { extractTitle, extractStatus, extractTags } = __testing;

describe('Notion property extractors', () => {
	it('extractTitle pulls plain text from title rich-text', () => {
		const prop = { type: 'title', title: [{ plain_text: 'Hello ' }, { plain_text: 'world' }] };
		assert.equal(extractTitle(prop as never), 'Hello world');
	});

	it('extractTitle returns null for empty title', () => {
		assert.equal(extractTitle({ type: 'title', title: [] } as never), null);
	});

	it('extractTitle returns null for non-title prop', () => {
		assert.equal(extractTitle({ type: 'select' } as never), null);
	});

	it('extractStatus handles status property', () => {
		const prop = { type: 'status', status: { name: 'In Progress' } };
		assert.equal(extractStatus(prop as never), 'In Progress');
	});

	it('extractStatus handles select property as fallback', () => {
		const prop = { type: 'select', select: { name: 'Open' } };
		assert.equal(extractStatus(prop as never), 'Open');
	});

	it('extractStatus returns null when status is unset', () => {
		assert.equal(extractStatus({ type: 'status', status: null } as never), null);
	});

	it('extractTags reads multi_select names', () => {
		const prop = {
			type: 'multi_select',
			multi_select: [{ name: 'bug' }, { name: 'p1' }],
		};
		assert.deepEqual(extractTags(prop as never), ['bug', 'p1']);
	});

	it('extractTags returns empty for non-multi_select', () => {
		assert.deepEqual(extractTags({ type: 'title' } as never), []);
	});
});

describe('NotionAdapter — constructor + property defaults', () => {
	it('uses default property names when not overridden', () => {
		const adapter = new NotionAdapter({ apiToken: 'tok', databaseId: 'db' });
		// We can't easily inspect private fields, but constructing without
		// `properties` should not throw.
		assert.ok(adapter);
	});

	it('accepts custom property name overrides', () => {
		const adapter = new NotionAdapter({
			apiToken: 'tok',
			databaseId: 'db',
			properties: { title: 'Título', status: 'Estado', tags: 'Etiquetas' },
		});
		assert.ok(adapter);
	});
});
