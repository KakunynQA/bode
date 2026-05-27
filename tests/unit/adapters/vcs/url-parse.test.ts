import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// These mirror the regexes used in github.ts / gitlab.ts after B9 fix.
// We assert they hold for realistic gh/glab stdout shapes.

describe('GitHub PR URL parsing (B9)', () => {
	const PR_RE = /https:\/\/[^\s]*\/pull\/\d+/;
	const NUM_RE = /\/pull\/(\d+)/;

	it('parses clean URL from gh output', () => {
		const stdout = 'https://github.com/acme/repo/pull/42\n';
		const m = stdout.match(PR_RE);
		assert.ok(m);
		assert.equal(m![0], 'https://github.com/acme/repo/pull/42');
		assert.equal(m![0].match(NUM_RE)![1], '42');
	});

	it('parses URL even with warning lines before it', () => {
		const stdout =
			'warning: some warning\nCreating pull request for foo\nhttps://github.com/acme/repo/pull/7\n';
		const m = stdout.match(PR_RE);
		assert.ok(m);
		assert.equal(m![0], 'https://github.com/acme/repo/pull/7');
	});

	it('parses URL with trailing query string into number correctly', () => {
		const url = 'https://github.com/acme/repo/pull/123?expand=1';
		const num = url.match(NUM_RE);
		assert.ok(num);
		assert.equal(num![1], '123');
	});
});

describe('GitLab MR URL parsing (B9)', () => {
	const MR_RE = /https:\/\/[^\s]*\/-\/merge_requests\/\d+/;
	const NUM_RE = /\/merge_requests\/(\d+)/;

	it('parses clean URL from glab output', () => {
		const stdout = 'https://gitlab.com/group/repo/-/merge_requests/9\n';
		const m = stdout.match(MR_RE);
		assert.ok(m);
		assert.equal(m![0].match(NUM_RE)![1], '9');
	});

	it('handles self-hosted gitlab URL', () => {
		const stdout = 'https://gitlab.example.com/team/project/-/merge_requests/100\n';
		const m = stdout.match(MR_RE);
		assert.ok(m);
		assert.equal(m![0].match(NUM_RE)![1], '100');
	});
});
