import type { JiraAdapter, JiraIssue, JiraComment, JiraTransition } from '~/types/jira.ts';
import type { Result } from '~/types/result.ts';

const mockIssues = new Map<string, JiraIssue>();
const mockComments = new Map<string, JiraComment[]>();
const mockLabels = new Map<string, Set<string>>();

export class MockJiraAdapter implements JiraAdapter {
	async getIssue(key: string, _signal?: AbortSignal): Promise<Result<JiraIssue>> {
		const issue = mockIssues.get(key);
		if (!issue) return { ok: false, error: new Error(`Issue ${key} not found`) };
		return { ok: true, value: { ...issue, labels: [...(mockLabels.get(key) ?? [])] } };
	}

	async addComment(key: string, body: string, _signal?: AbortSignal): Promise<Result<JiraComment>> {
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

	async transitionStatus(
		_key: string,
		_transitionName: string,
		_signal?: AbortSignal
	): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async addLabel(key: string, label: string, _signal?: AbortSignal): Promise<Result<void>> {
		const labels = mockLabels.get(key) ?? new Set();
		labels.add(label);
		mockLabels.set(key, labels);
		return { ok: true, value: undefined };
	}

	async removeLabel(key: string, label: string, _signal?: AbortSignal): Promise<Result<void>> {
		mockLabels.get(key)?.delete(label);
		return { ok: true, value: undefined };
	}

	async attachFile(
		_key: string,
		_filename: string,
		_content: string,
		_signal?: AbortSignal
	): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async getTransitions(_key: string, _signal?: AbortSignal): Promise<Result<JiraTransition[]>> {
		return {
			ok: true,
			value: [
				{ id: '1', name: 'Start Progress', toStatusName: 'In Progress' },
				{ id: '2', name: 'Done', toStatusName: 'Done' },
			],
		};
	}

	// ─── v0.25.0 provider-neutral aliases (delegate to legacy methods) ───

	async fetchTask(key: string, signal?: AbortSignal): Promise<Result<JiraIssue>> {
		return this.getIssue(key, signal);
	}
	async postComment(key: string, body: string, signal?: AbortSignal): Promise<Result<JiraComment>> {
		return this.addComment(key, body, signal);
	}
	async setStatus(key: string, statusName: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.transitionStatus(key, statusName, signal);
	}
	async addTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.addLabel(key, tag, signal);
	}
	async removeTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.removeLabel(key, tag, signal);
	}
	async listStatuses(key: string, signal?: AbortSignal): Promise<Result<JiraTransition[]>> {
		return this.getTransitions(key, signal);
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
