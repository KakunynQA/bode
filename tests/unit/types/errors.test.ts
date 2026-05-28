import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	isBodeError,
	bodeErrorToError,
	errorToBodeError,
	BODE_ERROR_KINDS,
	type BodeError,
} from '../../../src/types/errors.js';

describe('BODE_ERROR_KINDS', () => {
	it('has exactly 8 entries', () => {
		assert.strictEqual(BODE_ERROR_KINDS.length, 8);
	});

	it('contains all expected kinds', () => {
		const expected = [
			'config',
			'tracker',
			'phase',
			'adapter',
			'timeout',
			'network',
			'storage',
			'validation',
		];
		assert.deepStrictEqual([...BODE_ERROR_KINDS], expected);
	});
});

describe('isBodeError', () => {
	const validErrors: BodeError[] = [
		{ kind: 'config', code: 'missing_field', message: 'Missing field' },
		{ kind: 'tracker', code: 'auth_failed', message: 'Auth failed', provider: 'jira' },
		{ kind: 'phase', code: 'plan_missing', message: 'No plan', phase: 'plan' },
		{ kind: 'adapter', code: 'spawn_fail', message: 'Spawn failed', adapter: 'claude' },
		{ kind: 'timeout', code: 'cli_exit', message: 'Timed out', ms: 30000 },
		{ kind: 'network', code: 'fetch_fail', message: 'Fetch failed', status: 502 },
		{ kind: 'storage', code: 'file_read', message: 'Read failed', path: '/tmp/x' },
		{ kind: 'validation', code: 'schema_fail', message: 'Bad schema', issues: ['a', 'b'] },
	];

	for (const err of validErrors) {
		it(`returns true for kind="${err.kind}"`, () => {
			assert.strictEqual(isBodeError(err), true);
		});
	}

	it('returns false for plain Error', () => {
		assert.strictEqual(isBodeError(new Error('boom')), false);
	});

	it('returns false for null', () => {
		assert.strictEqual(isBodeError(null), false);
	});

	it('returns false for undefined', () => {
		assert.strictEqual(isBodeError(undefined), false);
	});

	it('returns false for string', () => {
		assert.strictEqual(isBodeError('error'), false);
	});

	it('returns false for plain object without kind', () => {
		assert.strictEqual(isBodeError({ message: 'oops' }), false);
	});

	it('returns false for object with invalid kind', () => {
		assert.strictEqual(isBodeError({ kind: 'unknown', message: 'x' }), false);
	});
});

describe('bodeErrorToError', () => {
	it('produces an Error with formatted message', () => {
		const err: BodeError = {
			kind: 'phase',
			code: 'abort',
			message: 'User aborted',
			phase: 'implement',
		};
		const result = bodeErrorToError(err);
		assert.ok(result instanceof Error);
		assert.strictEqual(result.message, '[phase:abort] User aborted');
	});

	it('includes hint when present', () => {
		const err: BodeError = {
			kind: 'config',
			code: 'bad_yaml',
			message: 'Invalid YAML',
			hint: 'Check ~/.bode/config.yml',
		};
		const result = bodeErrorToError(err);
		assert.ok(result.message.includes('Hint: Check ~/.bode/config.yml'));
	});

	it('includes issues when present', () => {
		const err: BodeError = {
			kind: 'validation',
			code: 'schema',
			message: 'Validation failed',
			issues: ['missing foo', 'extra bar'],
		};
		const result = bodeErrorToError(err);
		assert.ok(result.message.includes('Issues: missing foo; extra bar'));
	});

	it('omits hint section when not present', () => {
		const err: BodeError = { kind: 'timeout', code: 'cli', message: 'CLI timed out', ms: 5000 };
		const result = bodeErrorToError(err);
		assert.ok(!result.message.includes('Hint:'));
	});
});

describe('errorToBodeError', () => {
	it('passes through existing BodeError', () => {
		const original: BodeError = {
			kind: 'tracker',
			code: 'not_found',
			message: 'Ticket not found',
			provider: 'jira',
		};
		const result = errorToBodeError(original);
		assert.deepStrictEqual(result, original);
	});

	it('converts plain Error to fallback BodeError', () => {
		const result = errorToBodeError(new Error('Something broke'));
		assert.strictEqual(result.kind, 'phase');
		assert.strictEqual(result.code, 'unknown');
		assert.strictEqual(result.message, 'Something broke');
	});

	it('infers config kind from config-related message', () => {
		const result = errorToBodeError(new Error('Invalid config file'));
		assert.strictEqual(result.kind, 'config');
	});

	it('infers timeout kind from timeout message', () => {
		const result = errorToBodeError(new Error('Operation timed out'));
		assert.strictEqual(result.kind, 'timeout');
	});

	it('infers network kind from network message', () => {
		const result = errorToBodeError(new Error('fetch failed'));
		assert.strictEqual(result.kind, 'network');
	});

	it('infers storage kind from ENOENT message', () => {
		const result = errorToBodeError(new Error('ENOENT: no such file'));
		assert.strictEqual(result.kind, 'storage');
	});
});
