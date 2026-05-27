import type {
	IssueTrackerStrategy,
	IssueTask,
	IssueComment,
	IssueTransition,
} from '~/types/issue-tracker.ts';
import type { Result } from '~/types/result.ts';

const LINEAR_ENDPOINT = 'https://api.linear.app/graphql';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Linear tracker. Uses the GraphQL API directly via `fetch` (no SDK
 * dependency). Issues are identified by their Linear identifier, e.g.
 * `ENG-123`.
 *
 * Auth: API key from `LINEAR_API_KEY` env var or `linear.api_key` in config.
 * Get one at linear.app → Settings → API.
 *
 * Status mapping: Linear workflow states map directly. `setStatus(key, name)`
 * looks up the workflow state by name within the issue's team.
 *
 * Labels = tags (1:1).
 *
 * Comments via `commentCreate` mutation.
 *
 * Attachments via Linear's REST endpoint are not implemented (no-op).
 */
export class LinearAdapter implements IssueTrackerStrategy {
	private readonly apiKey: string;
	private readonly timeoutMs: number;

	constructor(options: { apiKey: string; timeoutMs?: number }) {
		this.apiKey = options.apiKey;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	private async gql<T>(
		query: string,
		variables: Record<string, unknown>,
		signal?: AbortSignal
	): Promise<Result<T>> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const composedSignal = signal ?? controller.signal;

		try {
			const response = await fetch(LINEAR_ENDPOINT, {
				method: 'POST',
				headers: {
					Authorization: this.apiKey,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ query, variables }),
				signal: composedSignal,
			});
			if (!response.ok) {
				const body = await response.text().catch(() => '');
				return {
					ok: false,
					error: new Error(`Linear API ${response.status}: ${body || response.statusText}`),
				};
			}
			const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
			if (json.errors?.length) {
				return {
					ok: false,
					error: new Error(
						`Linear GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`
					),
				};
			}
			return { ok: true, value: json.data as T };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err : new Error(String(err)),
			};
		} finally {
			clearTimeout(timer);
		}
	}

	async fetchTask(key: string, signal?: AbortSignal): Promise<Result<IssueTask>> {
		const query = `
			query Issue($id: String!) {
				issue(id: $id) {
					id
					identifier
					title
					description
					state { name type }
					labels { nodes { name } }
					assignee { name }
					url
				}
			}
		`;
		type Resp = {
			issue: {
				id: string;
				identifier: string;
				title: string;
				description: string | null;
				state: { name: string; type: string };
				labels: { nodes: { name: string }[] };
				assignee: { name: string } | null;
				url: string;
			} | null;
		};
		const r = await this.gql<Resp>(query, { id: key }, signal);
		if (!r.ok) return r;
		if (!r.value.issue) {
			return { ok: false, error: new Error(`Linear issue ${key} not found`) };
		}
		const issue = r.value.issue;
		return {
			ok: true,
			value: {
				key: issue.identifier,
				summary: issue.title,
				description: issue.description ?? '',
				status: issue.state.name,
				issueType: issue.state.type,
				assignee: issue.assignee?.name ?? null,
				labels: issue.labels.nodes.map((l) => l.name),
				url: issue.url,
			},
		};
	}

	async postComment(
		key: string,
		body: string,
		signal?: AbortSignal
	): Promise<Result<IssueComment>> {
		// Need to resolve identifier → uuid first.
		const issueR = await this.gql<{ issue: { id: string } | null }>(
			`query Issue($id: String!) { issue(id: $id) { id } }`,
			{ id: key },
			signal
		);
		if (!issueR.ok) return issueR;
		if (!issueR.value.issue) {
			return { ok: false, error: new Error(`Linear issue ${key} not found`) };
		}
		const id = issueR.value.issue.id;
		const mutation = `
			mutation Comment($issueId: String!, $body: String!) {
				commentCreate(input: { issueId: $issueId, body: $body }) {
					success
					comment { id body createdAt }
				}
			}
		`;
		type Resp = {
			commentCreate: { success: boolean; comment: { id: string; body: string; createdAt: string } };
		};
		const r = await this.gql<Resp>(mutation, { issueId: id, body }, signal);
		if (!r.ok) return r;
		if (!r.value.commentCreate.success) {
			return { ok: false, error: new Error('Linear commentCreate returned success=false') };
		}
		return {
			ok: true,
			value: {
				id: r.value.commentCreate.comment.id,
				body: r.value.commentCreate.comment.body,
				created: r.value.commentCreate.comment.createdAt,
			},
		};
	}

	async setStatus(key: string, statusName: string, signal?: AbortSignal): Promise<Result<void>> {
		if (statusName.trim() === '') return { ok: true, value: undefined };
		// Resolve issue id + team workflow states, find state by name.
		const issueR = await this.gql<{
			issue: {
				id: string;
				team: { id: string; states: { nodes: { id: string; name: string }[] } };
			} | null;
		}>(
			`query Issue($id: String!) {
				issue(id: $id) {
					id
					team {
						id
						states { nodes { id name } }
					}
				}
			}`,
			{ id: key },
			signal
		);
		if (!issueR.ok) return issueR;
		if (!issueR.value.issue) {
			return { ok: false, error: new Error(`Linear issue ${key} not found`) };
		}
		const states = issueR.value.issue.team.states.nodes;
		const target = states.find((s) => s.name.toLowerCase() === statusName.toLowerCase());
		if (!target) {
			return {
				ok: false,
				error: new Error(
					`Linear state "${statusName}" not found. Available: ${states.map((s) => s.name).join(', ')}`
				),
			};
		}
		const r = await this.gql<{ issueUpdate: { success: boolean } }>(
			`mutation U($id: String!, $stateId: String!) {
				issueUpdate(id: $id, input: { stateId: $stateId }) { success }
			}`,
			{ id: issueR.value.issue.id, stateId: target.id },
			signal
		);
		if (!r.ok) return r;
		if (!r.value.issueUpdate.success) {
			return { ok: false, error: new Error('Linear issueUpdate returned success=false') };
		}
		return { ok: true, value: undefined };
	}

	async addTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.toggleLabel(key, tag, 'add', signal);
	}

	async removeTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.toggleLabel(key, tag, 'remove', signal);
	}

	private async toggleLabel(
		key: string,
		tag: string,
		mode: 'add' | 'remove',
		signal?: AbortSignal
	): Promise<Result<void>> {
		// Linear labels are team-scoped. Resolve issue + label ids, then PATCH.
		const issueR = await this.gql<{
			issue: {
				id: string;
				team: { id: string; labels: { nodes: { id: string; name: string }[] } };
				labels: { nodes: { id: string; name: string }[] };
			} | null;
		}>(
			`query Issue($id: String!) {
				issue(id: $id) {
					id
					team {
						id
						labels { nodes { id name } }
					}
					labels { nodes { id name } }
				}
			}`,
			{ id: key },
			signal
		);
		if (!issueR.ok) return issueR;
		if (!issueR.value.issue) {
			return { ok: false, error: new Error(`Linear issue ${key} not found`) };
		}
		const currentIds = issueR.value.issue.labels.nodes.map((l) => l.id);
		const teamLabel = issueR.value.issue.team.labels.nodes.find(
			(l) => l.name.toLowerCase() === tag.toLowerCase()
		);
		if (!teamLabel && mode === 'add') {
			return {
				ok: false,
				error: new Error(
					`Linear label "${tag}" does not exist on the team. Create it in Linear first.`
				),
			};
		}
		if (!teamLabel && mode === 'remove') {
			return { ok: true, value: undefined };
		}
		const nextIds =
			mode === 'add'
				? Array.from(new Set([...currentIds, teamLabel!.id]))
				: currentIds.filter((id) => id !== teamLabel!.id);

		const r = await this.gql<{ issueUpdate: { success: boolean } }>(
			`mutation U($id: String!, $ids: [String!]!) {
				issueUpdate(id: $id, input: { labelIds: $ids }) { success }
			}`,
			{ id: issueR.value.issue.id, ids: nextIds },
			signal
		);
		if (!r.ok) return r;
		return { ok: true, value: undefined };
	}

	async attachFile(): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async listStatuses(key: string, signal?: AbortSignal): Promise<Result<IssueTransition[]>> {
		const r = await this.gql<{
			issue: { team: { states: { nodes: { id: string; name: string }[] } } } | null;
		}>(
			`query Issue($id: String!) {
				issue(id: $id) { team { states { nodes { id name } } } }
			}`,
			{ id: key },
			signal
		);
		if (!r.ok) return r;
		if (!r.value.issue) return { ok: true, value: [] };
		return {
			ok: true,
			value: r.value.issue.team.states.nodes.map((s) => ({
				id: s.id,
				name: s.name,
				toStatusName: s.name,
			})),
		};
	}

	// ─── v0.25.0 deprecated aliases ──────────────────────────────────────

	async getIssue(key: string, signal?: AbortSignal): Promise<Result<IssueTask>> {
		return this.fetchTask(key, signal);
	}
	async addComment(key: string, body: string, signal?: AbortSignal): Promise<Result<IssueComment>> {
		return this.postComment(key, body, signal);
	}
	async transitionStatus(key: string, name: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.setStatus(key, name, signal);
	}
	async addLabel(key: string, label: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.addTag(key, label, signal);
	}
	async removeLabel(key: string, label: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.removeTag(key, label, signal);
	}
	async getTransitions(key: string, signal?: AbortSignal): Promise<Result<IssueTransition[]>> {
		return this.listStatuses(key, signal);
	}
}
