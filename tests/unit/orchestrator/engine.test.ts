import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __testing } from '~/orchestrator/engine.ts';

const { getExecutingStatus, extractSummary, formatDuration } = __testing;

describe('getExecutingStatus', () => {
	it('maps planning to planning', () => {
		assert.equal(getExecutingStatus('planning'), 'planning');
	});

	it('maps planned to planning', () => {
		assert.equal(getExecutingStatus('planned'), 'planning');
	});

	it('maps implementing to implementing', () => {
		assert.equal(getExecutingStatus('implementing'), 'implementing');
	});

	it('maps reviewing to implementing', () => {
		assert.equal(getExecutingStatus('reviewing'), 'implementing');
	});

	it('maps reviewed to reviewing', () => {
		assert.equal(getExecutingStatus('reviewed'), 'reviewing');
	});

	it('returns null for pending', () => {
		assert.equal(getExecutingStatus('pending'), null);
	});

	it('returns null for awaiting-merge', () => {
		assert.equal(getExecutingStatus('awaiting-merge'), null);
	});

	it('returns null for done', () => {
		assert.equal(getExecutingStatus('done'), null);
	});

	it('returns null for aborted', () => {
		assert.equal(getExecutingStatus('aborted'), null);
	});

	it('returns null for failed', () => {
		assert.equal(getExecutingStatus('failed'), null);
	});
});

describe('extractSummary', () => {
	it('returns short artifact unchanged', () => {
		const artifact = 'line1\nline2\nline3';
		assert.equal(extractSummary(artifact, 3000), artifact);
	});

	it('returns empty string as-is', () => {
		assert.equal(extractSummary('', 3000), '');
	});

	it('returns single-char artifact as-is', () => {
		assert.equal(extractSummary('x', 3000), 'x');
	});

	it('truncates long artifact with truncation notice', () => {
		const lines = Array.from({ length: 200 }, (_, i) => `line ${i}: content here`);
		const artifact = lines.join('\n');
		const maxChars = 500;
		const result = extractSummary(artifact, maxChars);
		assert.ok(
			result.length <= maxChars + 200,
			`result length ${result.length} exceeds reasonable bound`
		);
		assert.match(result, /\.\.\.\(_truncated/);
	});

	it('keeps artifact exactly at maxChars', () => {
		const artifact = 'a'.repeat(100);
		assert.equal(extractSummary(artifact, 100), artifact);
	});

	it('truncates at exactly maxChars + 1', () => {
		const artifact = 'a'.repeat(101);
		const result = extractSummary(artifact, 100);
		assert.ok(result.length > 0);
		assert.ok(result.includes('truncated'));
	});

	it('preserves line boundaries during truncation', () => {
		const lines = ['short1', 'short2', 'short3'];
		const artifact = lines.join('\n');
		const maxChars = 20;
		const result = extractSummary(artifact, maxChars);
		const resultLines = result.split('\n').filter((l) => !l.includes('_truncated'));
		for (const line of resultLines) {
			assert.ok(lines.includes(line), `line "${line}" was not in original`);
		}
	});

	it('handles single very long line exceeding maxChars', () => {
		const artifact = 'x'.repeat(5000);
		const result = extractSummary(artifact, 3000);
		assert.ok(result.includes('truncated'));
	});

	it('handles artifact with all lines individually under limit', () => {
		const lines = ['a', 'b', 'c', 'd', 'e'];
		const artifact = lines.join('\n');
		assert.equal(extractSummary(artifact, 100), artifact);
	});

	it('works with maxChars of 1', () => {
		const artifact = 'hello world';
		const result = extractSummary(artifact, 1);
		assert.ok(result.length > 0);
		assert.ok(result.includes('truncated'));
	});
});

describe('formatDuration', () => {
	it('formats 0ms', () => {
		assert.equal(formatDuration(0), '0ms');
	});

	it('formats 1ms', () => {
		assert.equal(formatDuration(1), '1ms');
	});

	it('formats 500ms', () => {
		assert.equal(formatDuration(500), '500ms');
	});

	it('formats 999ms', () => {
		assert.equal(formatDuration(999), '999ms');
	});

	it('formats 1000ms as 1s', () => {
		assert.equal(formatDuration(1000), '1s');
	});

	it('formats 1500ms as 1s', () => {
		assert.equal(formatDuration(1500), '1s');
	});

	it('formats 59000ms as 59s', () => {
		assert.equal(formatDuration(59000), '59s');
	});

	it('formats 60000ms as 1m 0s', () => {
		assert.equal(formatDuration(60000), '1m 0s');
	});

	it('formats 65000ms as 1m 5s', () => {
		assert.equal(formatDuration(65000), '1m 5s');
	});

	it('formats 3600000ms as 60m 0s', () => {
		assert.equal(formatDuration(3600000), '60m 0s');
	});

	it('formats 3661000ms as 61m 1s', () => {
		assert.equal(formatDuration(3661000), '61m 1s');
	});

	it('formats 7200000ms as 120m 0s', () => {
		assert.equal(formatDuration(7200000), '120m 0s');
	});
});
