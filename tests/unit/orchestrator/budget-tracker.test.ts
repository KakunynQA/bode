import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertBudgetAvailable } from '~/orchestrator/budget-tracker.ts';
import { DEFAULT_CONFIG } from '~/config/defaults.ts';

describe('assertBudgetAvailable', () => {
	it('passes when no budget is configured', async () => {
		const result = await assertBudgetAvailable({
			taskKey: 'B-1',
			phase: 'planning',
			config: DEFAULT_CONFIG,
		});
		assert.equal(result.ok, true);
	});
});
