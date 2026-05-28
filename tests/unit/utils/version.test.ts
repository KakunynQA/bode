import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getVersion } from '~/utils/version.ts';

describe('getVersion', () => {
	it('returns a string', () => {
		const version = getVersion();
		assert.ok(typeof version === 'string');
	});

	it('returns a non-empty string', () => {
		const version = getVersion();
		assert.ok(version.length > 0);
	});

	it('matches semver pattern or fallback', () => {
		const version = getVersion();
		const semverOrDev = /^(\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?|0\.0\.0-dev)$/;
		assert.ok(semverOrDev.test(version), `unexpected version: ${version}`);
	});

	it('module imports without throwing', () => {
		assert.ok(typeof getVersion === 'function');
	});
});
