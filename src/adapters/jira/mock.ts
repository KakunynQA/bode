import type { JiraAdapter, JiraIssue, JiraComment, JiraTransition } from '~/types/jira.ts';
import type { Result } from '~/types/result.ts';

const mockIssues = new Map<string, JiraIssue>();
const mockComments = new Map<string, JiraComment[]>();
const mockLabels = new Map<string, Set<string>>();

export class MockJiraAdapter implements JiraAdapter {
	async getIssue(key: string): Promise<Result<JiraIssue>> {
		const issue = mockIssues.get(key);
		if (!issue) return { ok: false, error: new Error(`Issue ${key} not found`) };
		return { ok: true, value: { ...issue, labels: [...(mockLabels.get(key) ?? [])] } };
	}

	async addComment(key: string, body: string): Promise<Result<JiraComment>> {
		const comment: JiraComment = {
			id: `comment-${Date.now()}`,
			body,
			created: new Date().toISOString(),
		};
		const existing = mockComments.get(key) ?? [];
		existing.push(comment);
		mockComments.set(key, existing);
		return { ok: true, value: comment };
	}

	async transitionStatus(_key: string, _transitionName: string): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async addLabel(key: string, label: string): Promise<Result<void>> {
		const labels = mockLabels.get(key) ?? new Set();
		labels.add(label);
		mockLabels.set(key, labels);
		return { ok: true, value: undefined };
	}

	async removeLabel(key: string, label: string): Promise<Result<void>> {
		mockLabels.get(key)?.delete(label);
		return { ok: true, value: undefined };
	}

	async attachFile(_key: string, _filename: string, _content: string): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async getTransitions(_key: string): Promise<Result<JiraTransition[]>> {
		return {
			ok: true,
			value: [
				{ id: '1', name: 'Start Progress', toStatusName: 'In Progress' },
				{ id: '2', name: 'Done', toStatusName: 'Done' },
			],
		};
	}

	static seedIssue(issue: JiraIssue): void {
		mockIssues.set(issue.key, issue);
		mockLabels.set(issue.key, new Set(issue.labels));
		mockComments.set(issue.key, []);
	}

	static reset(): void {
		mockIssues.clear();
		mockComments.clear();
		mockLabels.clear();
	}
}
