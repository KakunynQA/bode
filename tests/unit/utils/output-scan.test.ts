import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectPermissionIssue } from '~/utils/output-scan.ts';

describe('detectPermissionIssue', () => {
	it('returns null for empty / clean output', () => {
		assert.equal(detectPermissionIssue(''), null);
		assert.equal(detectPermissionIssue(null), null);
		assert.equal(detectPermissionIssue(undefined), null);
		assert.equal(detectPermissionIssue('Everything is fine. Build succeeded.'), null);
	});

	it("matches the user's reported phrasing", () => {
		const out =
			'I need read access to the sibling repos (`kakunyn-grid` and `kakunyn-grid-ui`). The files I need to inspect live there. Could you grant permission to read from `D:\\projects\\kakunyn-grid`?';
		const hit = detectPermissionIssue(out);
		assert.ok(hit);
		assert.ok(['need-access', 'grant-permission', 'no-read-access'].includes(hit!.pattern));
	});

	it('matches EACCES error', () => {
		const out = "Error: EACCES: permission denied, open '/some/file'";
		const hit = detectPermissionIssue(out);
		assert.ok(hit);
	});

	it('matches "permission denied"', () => {
		const out = 'fatal: permission denied while reading config';
		const hit = detectPermissionIssue(out);
		assert.ok(hit);
		assert.equal(hit!.pattern, 'permission-denied');
	});

	it('matches "grant permission to read from"', () => {
		const out = 'Please grant permission to read from /some/path';
		const hit = detectPermissionIssue(out);
		assert.ok(hit);
	});

	it('extracts Windows-style paths from snippet', () => {
		const out =
			'I need read access to `D:\\projects\\kakunyn-grid` and `D:\\projects\\kakunyn-grid-ui` to inspect them.';
		const hit = detectPermissionIssue(out);
		assert.ok(hit);
		assert.ok(hit!.suggestedPaths.some((p) => p.includes('kakunyn-grid')));
	});

	it('extracts POSIX-style paths from snippet', () => {
		const out = 'I do not have read access to /home/user/repo and /var/data.';
		const hit = detectPermissionIssue(out);
		assert.ok(hit);
		assert.ok(hit!.suggestedPaths.some((p) => p.startsWith('/')));
	});

	it('snippet is bounded (no huge dump)', () => {
		const filler = 'lorem '.repeat(2000);
		const out = `${filler}\nPermission denied for repo\n${filler}`;
		const hit = detectPermissionIssue(out);
		assert.ok(hit);
		assert.ok(hit!.snippet.length < 500);
	});
});
