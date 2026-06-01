import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectArt, centerArt, __testing } from '~/tui/logo.ts';

const { measureArt, stripInvisible } = __testing;

describe('stripInvisible', () => {
	it('returns plain text unchanged', () => {
		assert.equal(stripInvisible('hello'), 'hello');
	});

	it('strips CSI sequences', () => {
		assert.equal(stripInvisible('\x1b[31mred\x1b[0m'), 'red');
	});
});

describe('measureArt', () => {
	it('measures single-line art', () => {
		const m = measureArt('hello');
		assert.equal(m.width, 5);
		assert.equal(m.height, 1);
	});

	it('measures multi-line art', () => {
		const m = measureArt('ab\ncde\nf');
		assert.equal(m.width, 3);
		assert.equal(m.height, 3);
	});

	it('measures empty string as 0 width, 1 height', () => {
		const m = measureArt('');
		assert.equal(m.width, 0);
		assert.equal(m.height, 1);
	});
});

describe('selectArt', () => {
	const fullArt = 'A\nB\nC\nD\nE\nF\nG\nH\nI\nJ';
	const compactArt = 'X\nY';

	it('selects full art when it fits', () => {
		const result = selectArt(100, 50, { fullArt, compactArt, textFallback: 'BODE' });
		assert.equal(result.choice, 'full');
		assert.equal(result.art, fullArt);
	});

	it('selects compact art when full does not fit width', () => {
		const wideArt = 'A'.repeat(200) + '\nB';
		const result = selectArt(80, 50, { fullArt: wideArt, compactArt, textFallback: 'BODE' });
		assert.equal(result.choice, 'compact');
		assert.equal(result.art, compactArt);
	});

	it('selects compact art when full does not fit height', () => {
		const tallArt = Array.from({ length: 50 }, (_, i) => String(i)).join('\n');
		const result = selectArt(80, 24, { fullArt: tallArt, compactArt, textFallback: 'BODE' });
		assert.equal(result.choice, 'compact');
	});

	it('falls back to text when neither fits', () => {
		const result = selectArt(20, 5, {
			fullArt: 'A'.repeat(200),
			compactArt: 'X\nY\nZ\nW\nV\nU\nT\nS\nR\nQ',
			textFallback: 'BODE',
		});
		assert.equal(result.choice, 'text');
		assert.equal(result.art, 'BODE');
	});

	it('never contains opencode', () => {
		const result = selectArt(80, 24);
		assert.ok(!result.art.toLowerCase().includes('opencode'));
	});
});

describe('centerArt', () => {
	it('centers single-line art in 80 cols', () => {
		const centered = centerArt('hello', 80);
		const lines = centered.split('\n');
		assert.equal(lines.length, 1);
		assert.equal(lines[0]!.length, 37 + 5);
		assert.ok(lines[0]!.startsWith(' '.repeat(37)));
	});

	it('centers multi-line art', () => {
		const centered = centerArt('ab\ncdef', 20);
		const lines = centered.split('\n');
		assert.equal(lines.length, 2);
		assert.ok(lines[0]!.startsWith('  '));
		assert.ok(lines[1]!.startsWith(' '));
	});
});
