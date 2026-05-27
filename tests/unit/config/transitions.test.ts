import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveJiraTransition, listConfiguredTransitions } from '~/config/transitions.ts';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';

const baseConfig: BodeConfig = {
	jira: { site: 'x.atlassian.net', default_project: 'X' },
	phases: {
		planning: { cli: 'c', model: 'm', timeout_minutes: 1 },
		implementation: { cli: 'c', model: 'm', timeout_minutes: 1 },
		review: { cli: 'c', model: 'm', timeout_minutes: 1 },
	},
};

describe('resolveJiraTransition', () => {
	it('returns built-in defaults when nothing configured', () => {
		assert.equal(resolveJiraTransition('planning', baseConfig), 'In Progress');
		assert.equal(resolveJiraTransition('implementation', baseConfig), 'In Progress');
		assert.equal(resolveJiraTransition('review', baseConfig), 'In Progress');
		assert.equal(resolveJiraTransition('awaiting_merge', baseConfig), 'Code Review');
		assert.equal(resolveJiraTransition('done', baseConfig), 'Done');
	});

	it('global config overrides defaults', () => {
		const cfg: BodeConfig = {
			...baseConfig,
			jira: { ...baseConfig.jira, transitions: { awaiting_merge: 'To Review' } },
		};
		assert.equal(resolveJiraTransition('awaiting_merge', cfg), 'To Review');
		// Other keys still use defaults
		assert.equal(resolveJiraTransition('done', cfg), 'Done');
	});

	it('project config overrides global config', () => {
		const cfg: BodeConfig = {
			...baseConfig,
			jira: { ...baseConfig.jira, transitions: { done: 'Done' } },
		};
		const proj: ProjectConfig = {
			name: 'p',
			workdir: '/tmp',
			jira: { transitions: { done: 'Closed' } },
		};
		assert.equal(resolveJiraTransition('done', cfg, proj), 'Closed');
	});

	it('empty string is a valid override meaning "skip transition"', () => {
		const cfg: BodeConfig = {
			...baseConfig,
			jira: { ...baseConfig.jira, transitions: { implementation: '' } },
		};
		assert.equal(resolveJiraTransition('implementation', cfg), '');
	});

	it('listConfiguredTransitions returns all 5 keys', () => {
		const all = listConfiguredTransitions(baseConfig);
		assert.equal(Object.keys(all).length, 5);
		assert.ok('awaiting_merge' in all);
	});
});
