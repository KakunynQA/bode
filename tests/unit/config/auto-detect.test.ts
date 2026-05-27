import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __testing } from '~/config/auto-detect.ts';

const { inferProvider, parseSlug } = __testing;

describe('inferProvider', () => {
	it('detects GitHub from SSH URL', () => {
		assert.equal(inferProvider('git@github.com:KakunynQA/bode.git'), 'github');
	});
	it('detects GitHub from HTTPS URL', () => {
		assert.equal(inferProvider('https://github.com/acme/repo'), 'github');
	});
	it('detects GitLab.com from SSH URL', () => {
		assert.equal(inferProvider('git@gitlab.com:group/repo.git'), 'gitlab');
	});
	it('detects self-hosted GitLab', () => {
		assert.equal(inferProvider('https://gitlab.example.com/team/repo'), 'gitlab');
	});
	it('returns null for unknown providers', () => {
		assert.equal(inferProvider('https://bitbucket.org/x/y'), null);
		assert.equal(inferProvider('not a url'), null);
	});
});

describe('parseSlug', () => {
	it('parses SSH form', () => {
		assert.deepEqual(parseSlug('git@github.com:acme/repo.git'), { org: 'acme', repo: 'repo' });
	});
	it('parses SSH without .git', () => {
		assert.deepEqual(parseSlug('git@github.com:acme/repo'), { org: 'acme', repo: 'repo' });
	});
	it('parses HTTPS form', () => {
		assert.deepEqual(parseSlug('https://github.com/acme/repo.git'), {
			org: 'acme',
			repo: 'repo',
		});
	});
	it('parses HTTPS without .git and trailing slash', () => {
		assert.deepEqual(parseSlug('https://gitlab.com/team/project/'), {
			org: 'team',
			repo: 'project',
		});
	});
	it('returns null for unparseable input', () => {
		assert.equal(parseSlug('something-not-a-url'), null);
	});
});
