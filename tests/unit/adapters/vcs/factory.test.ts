import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createVcsAdapter } from '~/adapters/vcs/factory.ts';
import { GitHubAdapter } from '~/adapters/vcs/github.ts';
import { GitLabAdapter } from '~/adapters/vcs/gitlab.ts';

describe('createVcsAdapter', () => {
	it('returns GitHubAdapter for "github"', () => {
		assert.ok(createVcsAdapter('github') instanceof GitHubAdapter);
	});
	it('returns GitLabAdapter for "gitlab"', () => {
		assert.ok(createVcsAdapter('gitlab') instanceof GitLabAdapter);
	});
});
