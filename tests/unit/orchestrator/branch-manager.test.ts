import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { branchNameForTask } from '~/orchestrator/branch-manager.ts';

describe('branchNameForTask', () => {
	it('maps Story to feat/', () => {
		assert.equal(branchNameForTask('KD-312', 'Story'), 'feat/kd-312');
	});

	it('maps Bug to fix/', () => {
		assert.equal(branchNameForTask('KD-100', 'Bug'), 'fix/kd-100');
	});

	it('maps Task to chore/', () => {
		assert.equal(branchNameForTask('KD-200', 'Task'), 'chore/kd-200');
	});

	it('maps Improvement to refactor/', () => {
		assert.equal(branchNameForTask('KD-300', 'Improvement'), 'refactor/kd-300');
	});

	it('maps unknown types to feat/', () => {
		assert.equal(branchNameForTask('KD-400', 'CustomType'), 'feat/kd-400');
	});

	it('handles case-insensitive issue types', () => {
		assert.equal(branchNameForTask('KD-312', 'story'), 'feat/kd-312');
		assert.equal(branchNameForTask('KD-312', 'BUG'), 'fix/kd-312');
	});

	it('handles sub-task', () => {
		assert.equal(branchNameForTask('KD-500', 'Sub-task'), 'feat/kd-500');
	});

	it('lowercases task key', () => {
		assert.equal(branchNameForTask('PROJ-123', 'Story'), 'feat/proj-123');
	});
});
