import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __testing } from '~/cli/actions/fast.ts';

const { generateKey, TICKET_KEY_RE } = __testing;

describe('TICKET_KEY_RE', () => {
	it('matches standard Jira keys', () => {
		assert.ok(TICKET_KEY_RE.test('KD-312'));
		assert.ok(TICKET_KEY_RE.test('GRD-1'));
		assert.ok(TICKET_KEY_RE.test('PROJECT-9999'));
	});

	it('matches keys with underscores or digits in the project part', () => {
		assert.ok(TICKET_KEY_RE.test('PRJ_2-1'));
		assert.ok(TICKET_KEY_RE.test('A1B2-42'));
	});

	it('does not match freeform prompts', () => {
		assert.ok(!TICKET_KEY_RE.test('fix the bug'));
		assert.ok(!TICKET_KEY_RE.test('kd-312'));
		assert.ok(!TICKET_KEY_RE.test('123-KD'));
		assert.ok(!TICKET_KEY_RE.test('KD'));
		assert.ok(!TICKET_KEY_RE.test('KD-'));
	});
});

describe('generateKey', () => {
	it('produces a slug-friendly key with stamp prefix', () => {
		const key = generateKey('Fix the dashboard bug');
		assert.match(key, /^auto-\d{8}-\d{4}-fix-the-dashboard-bug$/);
	});

	it('truncates very long prompts', () => {
		const long = 'a'.repeat(200) + ' end';
		const key = generateKey(long);
		// The slug part is capped at 40 chars; total key < 80.
		assert.ok(key.length < 80, key);
	});

	it('handles prompts with no alphanumerics', () => {
		const key = generateKey('!!! ??? ###');
		assert.match(key, /^auto-\d{8}-\d{4}-task$/);
	});

	it('strips leading and trailing dashes', () => {
		const key = generateKey('  hello world  ');
		assert.match(key, /^auto-\d{8}-\d{4}-hello-world$/);
	});
});
