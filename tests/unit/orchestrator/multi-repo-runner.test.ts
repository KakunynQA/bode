import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMultiRepoPlan } from '~/orchestrator/multi-repo-runner.ts';

describe('buildMultiRepoPlan', () => {
	it('maps configured repos into a runnable plan', () => {
		const plan = buildMultiRepoPlan({
			name: 'x',
			workdir: '/repo',
			repos: [{ name: 'api', workdir: '/api', role: 'backend', optional: true }],
		});
		assert.deepEqual(plan.repos, [
			{ name: 'api', workdir: '/api', role: 'backend', optional: true },
		]);
	});
});
