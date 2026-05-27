import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNextPhase, getPhaseStatusLabel, getPhaseNameForStatus } from '~/types/phase.ts';

describe('phase status with awaiting-merge', () => {
	it('transitions reviewed to awaiting-merge', () => {
		assert.equal(getNextPhase('reviewed'), 'awaiting-merge');
	});

	it('transitions awaiting-merge to done', () => {
		assert.equal(getNextPhase('awaiting-merge'), 'done');
	});

	it('done has no next phase', () => {
		assert.equal(getNextPhase('done'), null);
	});

	it('labels awaiting-merge correctly', () => {
		assert.equal(getPhaseStatusLabel('awaiting-merge'), 'Awaiting Merge');
	});

	it('awaiting-merge has no phase name', () => {
		assert.equal(getPhaseNameForStatus('awaiting-merge'), null);
	});

	it('full lifecycle: pending to done', () => {
		const expected: Array<[string, string | null]> = [
			['pending', 'planning'],
			['planning', 'planned'],
			['planned', 'implementing'],
			['implementing', 'reviewing'],
			['reviewing', 'reviewed'],
			['reviewed', 'awaiting-merge'],
			['awaiting-merge', 'done'],
			['done', null],
		];
		for (const [from, expected_to] of expected) {
			assert.equal(getNextPhase(from as never), expected_to, `from ${from}`);
		}
	});
});
