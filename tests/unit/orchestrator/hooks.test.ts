import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __testing } from '~/orchestrator/hooks.ts';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';

const { resolveHooks } = __testing;

const baseConfig: BodeConfig = {
	jira: {},
	phases: {
		planning: { cli: 'c', model: 'm', timeout_minutes: 1 },
		implementation: { cli: 'c', model: 'm', timeout_minutes: 1 },
		review: { cli: 'c', model: 'm', timeout_minutes: 1 },
	},
};

describe('resolveHooks', () => {
	it('returns empty when no hooks configured', () => {
		assert.deepEqual(resolveHooks('pre_implementation', baseConfig), []);
	});

	it('reads global hooks', () => {
		const cfg = { ...baseConfig, hooks: { pre_implementation: ['npm test'] } };
		assert.deepEqual(resolveHooks('pre_implementation', cfg as never), ['npm test']);
	});

	it('appends project hooks after global', () => {
		const cfg = { ...baseConfig, hooks: { pre_implementation: ['npm test'] } };
		const proj: ProjectConfig & { hooks?: never } = {
			name: 'p',
			workdir: '/tmp',
			hooks: { pre_implementation: ['npm run lint'] },
		} as never;
		const r = resolveHooks('pre_implementation', cfg as never, proj as never);
		assert.deepEqual(r, ['npm test', 'npm run lint']);
	});

	it('accepts structured hook entries', () => {
		const cfg = {
			...baseConfig,
			hooks: { post_review: [{ run: 'notify.sh', non_blocking: true }] },
		};
		const r = resolveHooks('post_review', cfg as never);
		assert.deepEqual(r, [{ run: 'notify.sh', non_blocking: true }]);
	});
});
