import type { VcsAdapter, VcsProvider } from '~/types/vcs.ts';
import { GitHubAdapter } from '~/adapters/vcs/github.ts';
import { GitLabAdapter } from '~/adapters/vcs/gitlab.ts';

export function createVcsAdapter(provider: VcsProvider): VcsAdapter {
	switch (provider) {
		case 'gitlab':
			return new GitLabAdapter();
		case 'github':
		default:
			return new GitHubAdapter();
	}
}
