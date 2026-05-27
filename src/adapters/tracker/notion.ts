import type {
	IssueTrackerStrategy,
	IssueTask,
	IssueComment,
	IssueTransition,
} from '~/types/issue-tracker.ts';
import type { Result } from '~/types/result.ts';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Notion tracker. Treats a Notion database as the task list; each page is a
 * task. Requires a configured database with at least three properties:
 *
 *   - title  (default name: "Name")    — type: title
 *   - status (default name: "Status")  — type: status OR select
 *   - tags   (default name: "Tags")    — type: multi_select
 *
 * Property names can be overridden via `notion.properties` in config.
 *
 * Auth: integration token from `NOTION_TOKEN` env var or `notion.api_token`.
 * Create one at notion.so/my-integrations and grant it access to the database.
 *
 * Task keys: bode uses the Notion page id as the key. Either the dashed UUID
 * form (`abc-123-...`) or the bare form (`abc123...`) works.
 */
export class NotionAdapter implements IssueTrackerStrategy {
	private readonly token: string;
	private readonly databaseId: string;
	private readonly titleProp: string;
	private readonly statusProp: string;
	private readonly tagsProp: string;
	private readonly timeoutMs: number;

	constructor(options: {
		apiToken: string;
		databaseId: string;
		properties?:
			| { title?: string | undefined; status?: string | undefined; tags?: string | undefined }
			| undefined;
		timeoutMs?: number;
	}) {
		this.token = options.apiToken;
		this.databaseId = options.databaseId;
		this.titleProp = options.properties?.title ?? 'Name';
		this.statusProp = options.properties?.status ?? 'Status';
		this.tagsProp = options.properties?.tags ?? 'Tags';
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
		signal?: AbortSignal
	): Promise<Result<T>> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const composedSignal = signal ?? controller.signal;

		try {
			const init: RequestInit = {
				method,
				headers: {
					Authorization: `Bearer ${this.token}`,
					'Notion-Version': NOTION_VERSION,
					'Content-Type': 'application/json',
				},
				signal: composedSignal,
			};
			if (body !== undefined) init.body = JSON.stringify(body);
			const response = await fetch(`${NOTION_BASE}${path}`, init);
			if (!response.ok) {
				const text = await response.text().catch(() => '');
				return {
					ok: false,
					error: new Error(`Notion API ${response.status}: ${text || response.statusText}`),
				};
			}
			const data = await response.json();
			return { ok: true, value: data as T };
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
		type Page = {
			id: string;
			url: string;
			properties: Record<string, NotionProperty>;
		};
		const r = await this.request<Page>('GET', `/pages/${key}`, undefined, signal);
		if (!r.ok) return r;

		const props = r.value.properties;
		const titleProp = props[this.titleProp];
		const statusProp = props[this.statusProp];
		const tagsProp = props[this.tagsProp];

		return {
			ok: true,
			value: {
				key: r.value.id,
				summary: extractTitle(titleProp) ?? '(no title)',
				description: '',
				status: extractStatus(statusProp) ?? 'pending',
				issueType: 'Task',
				assignee: null,
				labels: extractTags(tagsProp),
				url: r.value.url,
			},
		};
	}

	async postComment(
		key: string,
		body: string,
		signal?: AbortSignal
	): Promise<Result<IssueComment>> {
		type Resp = { id: string; created_time: string };
		const r = await this.request<Resp>(
			'POST',
			`/comments`,
			{
				parent: { page_id: key },
				rich_text: [{ type: 'text', text: { content: body } }],
			},
			signal
		);
		if (!r.ok) return r;
		return {
			ok: true,
			value: { id: r.value.id, body, created: r.value.created_time },
		};
	}

	async setStatus(key: string, statusName: string, signal?: AbortSignal): Promise<Result<void>> {
		if (statusName.trim() === '') return { ok: true, value: undefined };
		const r = await this.request<unknown>(
			'PATCH',
			`/pages/${key}`,
			{
				properties: {
					[this.statusProp]: { status: { name: statusName } },
				},
			},
			signal
		);
		if (!r.ok) return r;
		return { ok: true, value: undefined };
	}

	async addTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.modifyTags(key, tag, 'add', signal);
	}

	async removeTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		return this.modifyTags(key, tag, 'remove', signal);
	}

	private async modifyTags(
		key: string,
		tag: string,
		mode: 'add' | 'remove',
		signal?: AbortSignal
	): Promise<Result<void>> {
		const issue = await this.fetchTask(key, signal);
		if (!issue.ok) return issue;
		const next =
			mode === 'add'
				? Array.from(new Set([...issue.value.labels, tag]))
				: issue.value.labels.filter((t) => t !== tag);
		const r = await this.request<unknown>(
			'PATCH',
			`/pages/${key}`,
			{
				properties: {
					[this.tagsProp]: { multi_select: next.map((name) => ({ name })) },
				},
			},
			signal
		);
		if (!r.ok) return r;
		return { ok: true, value: undefined };
	}

	async attachFile(): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async listStatuses(_key: string, signal?: AbortSignal): Promise<Result<IssueTransition[]>> {
		type DbResp = {
			properties: Record<
				string,
				{
					type: string;
					status?: { options: { id: string; name: string }[] };
					select?: { options: { id: string; name: string }[] };
				}
			>;
		};
		const r = await this.request<DbResp>('GET', `/databases/${this.databaseId}`, undefined, signal);
		if (!r.ok) return r;
		const prop = r.value.properties[this.statusProp];
		const options = prop?.status?.options ?? prop?.select?.options ?? [];
		return {
			ok: true,
			value: options.map((o) => ({ id: o.id, name: o.name, toStatusName: o.name })),
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

// ──────────────────────────────────────────────────────────────────────────
// Notion property shape helpers

type NotionProperty =
	| { type: 'title'; title: { plain_text: string }[] }
	| { type: 'status'; status: { name: string } | null }
	| { type: 'select'; select: { name: string } | null }
	| { type: 'multi_select'; multi_select: { name: string }[] }
	| { type: string; [k: string]: unknown };

function extractTitle(prop: NotionProperty | undefined): string | null {
	if (!prop || prop.type !== 'title') return null;
	const p = prop as Extract<NotionProperty, { type: 'title' }>;
	return p.title.map((t) => t.plain_text).join('') || null;
}

function extractStatus(prop: NotionProperty | undefined): string | null {
	if (!prop) return null;
	if (prop.type === 'status') {
		return (prop as Extract<NotionProperty, { type: 'status' }>).status?.name ?? null;
	}
	if (prop.type === 'select') {
		return (prop as Extract<NotionProperty, { type: 'select' }>).select?.name ?? null;
	}
	return null;
}

function extractTags(prop: NotionProperty | undefined): string[] {
	if (!prop || prop.type !== 'multi_select') return [];
	return (prop as Extract<NotionProperty, { type: 'multi_select' }>).multi_select.map(
		(t) => t.name
	);
}

export const __testing = { extractTitle, extractStatus, extractTags };
