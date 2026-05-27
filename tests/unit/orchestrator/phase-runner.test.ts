import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __testing } from '~/orchestrator/phase-runner.ts';

const { getCurrentLabelKey, getNextLabelKey } = __testing;

describe('phase-runner label mapping (B1 regression)', () => {
	it('planning currentLabel is "planning"', () => {
		assert.equal(getCurrentLabelKey('planning'), 'planning');
	});
	it('implementation currentLabel is "implementing" not "implementation"', () => {
		assert.equal(getCurrentLabelKey('implementation'), 'implementing');
	});
	it('review currentLabel is "reviewing" not "review"', () => {
		assert.equal(getCurrentLabelKey('review'), 'reviewing');
	});
	it('planning advances to "planned"', () => {
		assert.equal(getNextLabelKey('planning'), 'planned');
	});
	it('implementation advances to "reviewing"', () => {
		assert.equal(getNextLabelKey('implementation'), 'reviewing');
	});
	it('review advances to "reviewed"', () => {
		assert.equal(getNextLabelKey('review'), 'reviewed');
	});
});
