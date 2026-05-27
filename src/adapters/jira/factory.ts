import type { JiraAdapter } from '~/types/jira.ts';
import { MockJiraAdapter } from '~/adapters/jira/mock.ts';
import { RealJiraAdapter } from '~/adapters/jira/rest.ts';

export function createJiraAdapter(config: {
	site: string;
	email?: string | undefined;
	api_token?: string | undefined;
}): JiraAdapter {
	if (config.email && config.api_token) {
		return new RealJiraAdapter(config.site, config.email, config.api_token);
	}
	return new MockJiraAdapter();
}
