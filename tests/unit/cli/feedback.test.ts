import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedbackUrl } from '~/cli/actions/feedback.ts';

describe('buildFeedbackUrl', () => {
	it('builds a prefilled GitHub issue URL without submitting anything', () => {
		const url = new URL(buildFeedbackUrl({ title: 'Great tool' }));
		assert.equal(url.origin, 'https://github.com');
		assert.equal(url.pathname, '/KakunynQA/bode/issues/new');
		assert.equal(url.searchParams.get('title'), 'Great tool');
		assert.equal(url.searchParams.get('labels'), 'feedback');
		assert.match(url.searchParams.get('body') ?? '', /Bode version:/);
	});
});
