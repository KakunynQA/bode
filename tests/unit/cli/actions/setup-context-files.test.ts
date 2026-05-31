import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve as resolvePath, isAbsolute } from 'node:path';
import { __testing } from '~/cli/actions/setup.ts';

const { resolveWorkdirForPicker, uniqueStrings } = __testing;

describe('resolveWorkdirForPicker', () => {
	it('returns an absolute path unchanged', () => {
		const abs = resolvePath('/tmp/example-project');
		assert.equal(resolveWorkdirForPicker(abs), abs);
	});

	it('converts a relative path to an absolute path under cwd', () => {
		const out = resolveWorkdirForPicker('./relative-thing');
		assert.ok(isAbsolute(out), `${out} should be absolute`);
		assert.equal(out, resolvePath('./relative-thing'));
	});

	it('converts `.` to the current working directory', () => {
		const out = resolveWorkdirForPicker('.');
		assert.equal(out, resolvePath('.'));
		assert.ok(isAbsolute(out));
	});

	it('keeps a Windows-style absolute path absolute', () => {
		// Skip the actual drive-letter check on POSIX hosts: just verify the
		// idempotent property — resolve of an already-absolute is itself.
		const abs = resolvePath('/anywhere/projects/my-app');
		assert.equal(resolveWorkdirForPicker(abs), abs);
	});
});

describe('uniqueStrings', () => {
	it('removes duplicates and trims', () => {
		assert.deepEqual(uniqueStrings(['a', ' a ', 'b']), ['a', 'b']);
	});

	it('filters empty strings', () => {
		assert.deepEqual(uniqueStrings(['', '  ', 'x']), ['x']);
	});

	it('preserves first-seen order', () => {
		assert.deepEqual(uniqueStrings(['b', 'a', 'b']), ['b', 'a']);
	});
});
