import type {
	IssueTrackerStrategy,
	IssueTask,
	IssueComment,
	IssueTransition,
} from '~/types/issue-tracker.ts';
import type { Result } from '~/types/result.ts';

const TRELLO_BASE = 'https://api.trello.com/1';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Trello tracker. Cards are tasks, lists are statuses, labels are tags.
 *
 * Auth: API key + token, both required. Get them at trello.com/app-key.
 * Configure via `trello.api_key` + `trello.token`, or `TRELLO_KEY` +
 * `TRELLO_TOKEN` env vars.
 *
 * Task keys: Trello card id (24-char hex) or shortLink (8 chars from the URL,
 * e.g. `https://trello.com/c/abc12345/...`).
 *
 * Status mapping: `setStatus("In Progress")` finds the list named "In
 * Progress" on the card's board and moves the card there. List name match is
 * case-insensitive. If the list doesn't exist, returns an error.
 *
 * Tags: card labels. Adapter creates the label on the board if it doesn't
 * exist when `addTag` is called.
 */
export class TrelloAdapter implements IssueTrackerStrategy {
	private readonly apiKey: string;
	private readonly token: string;
	private readonly timeoutMs: number;

	constructor(options: { apiKey: string; token: string; timeoutMs?: number }) {
		this.apiKey = options.apiKey;
		this.token = options.token;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	private authQS(extra: Record<string, string> = {}): string {
		const params = new URLSearchParams({ key: this.apiKey, token: this.token, ...extra });
		return params.toString();
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
		signal?: AbortSignal,
		extraQS: Record<string, string> = {}
	): Promise<Result<T>> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const composedSignal = signal ?? controller.signal;

		try {
			const url = `${TRELLO_BASE}${path}?${this.authQS(extraQS)}`;
			const init: RequestInit = {
				method,
				headers: { 'Content-Type': 'application/json' },
				signal: composedSignal,
			};
			if (body !== undefined) init.body = JSON.stringify(body);
			const response = await fetch(url, init);
			if (!response.ok) {
				const text = await response.text().catch(() => '');
				return {
					ok: false,
					error: new Error(`Trello API ${response.status}: ${text || response.statusText}`),
				};
			}
			const ct = response.headers.get('content-type') ?? '';
			if (!ct.includes('application/json')) {
				return { ok: true, value: undefined as unknown as T };
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
		type Card = {
			id: string;
			name: string;
			desc: string;
			shortUrl: string;
			idList: string;
			idLabels: string[];
			labels: { id: string; name: string; color: string }[];
		};
		const card = await this.request<Card>('GET', `/cards/${key}`, undefined, signal, {
			fields: 'name,desc,shortUrl,idList,idLabels',
			labels: 'true',
		});
		if (!card.ok) return card;
		const list = await this.request<{ name: string }>(
			'GET',
			`/lists/${card.value.idList}`,
			undefined,
			signal,
			{ fields: 'name' }
		);
		const status = list.ok ? list.value.name : 'unknown';

		return {
			ok: true,
			value: {
				key: card.value.id,
				summary: card.value.name,
				description: card.value.desc,
				status,
				issueType: 'Task',
				assignee: null,
				labels: card.value.labels.map((l) => l.name || l.color),
				url: card.value.shortUrl,
			},
		};
	}

	async postComment(
		key: string,
		body: string,
		signal?: AbortSignal
	): Promise<Result<IssueComment>> {
		type Resp = { id: string; date: string };
		const r = await this.request<Resp>(
			'POST',
			`/cards/${key}/actions/comments`,
			undefined,
			signal,
			{ text: body }
		);
		if (!r.ok) return r;
		return { ok: true, value: { id: r.value.id, body, created: r.value.date } };
	}

	async setStatus(key: string, statusName: string, signal?: AbortSignal): Promise<Result<void>> {
		if (statusName.trim() === '') return { ok: true, value: undefined };
		// Find the board, then the list with matching name.
		const card = await this.request<{ idBoard: string }>(
			'GET',
			`/cards/${key}`,
			undefined,
			signal,
			{ fields: 'idBoard' }
		);
		if (!card.ok) return card;
		const lists = await this.request<{ id: string; name: string }[]>(
			'GET',
			`/boards/${card.value.idBoard}/lists`,
			undefined,
			signal,
			{ fields: 'name' }
		);
		if (!lists.ok) return lists;
		const target = lists.value.find((l) => l.name.toLowerCase() === statusName.toLowerCase());
		if (!target) {
			return {
				ok: false,
				error: new Error(
					`Trello list "${statusName}" not found on board. Available: ${lists.value.map((l) => l.name).join(', ')}`
				),
			};
		}
		const r = await this.request<unknown>('PUT', `/cards/${key}`, undefined, signal, {
			idList: target.id,
		});
		if (!r.ok) return r;
		return { ok: true, value: undefined };
	}

	async addTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		const card = await this.request<{ idBoard: string }>(
			'GET',
			`/cards/${key}`,
			undefined,
			signal,
			{ fields: 'idBoard' }
		);
		if (!card.ok) return card;
		const labels = await this.request<{ id: string; name: string }[]>(
			'GET',
			`/boards/${card.value.idBoard}/labels`,
			undefined,
			signal,
			{ fields: 'name' }
		);
		if (!labels.ok) return labels;
		let labelId = labels.value.find((l) => l.name === tag)?.id;
		if (!labelId) {
			const created = await this.request<{ id: string }>(
				'POST',
				`/boards/${card.value.idBoard}/labels`,
				undefined,
				signal,
				{ name: tag, color: 'sky' }
			);
			if (!created.ok) return created;
			labelId = created.value.id;
		}
		const r = await this.request<unknown>('POST', `/cards/${key}/idLabels`, undefined, signal, {
			value: labelId,
		});
		if (!r.ok) return r;
		return { ok: true, value: undefined };
	}

	async removeTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>> {
		const card = await this.request<{ idBoard: string }>(
			'GET',
			`/cards/${key}`,
			undefined,
			signal,
			{ fields: 'idBoard' }
		);
		if (!card.ok) return card;
		const labels = await this.request<{ id: string; name: string }[]>(
			'GET',
			`/boards/${card.value.idBoard}/labels`,
			undefined,
			signal,
			{ fields: 'name' }
		);
		if (!labels.ok) return labels;
		const labelId = labels.value.find((l) => l.name === tag)?.id;
		if (!labelId) return { ok: true, value: undefined };
		const r = await this.request<unknown>(
			'DELETE',
			`/cards/${key}/idLabels/${labelId}`,
			undefined,
			signal
		);
		if (!r.ok) return r;
		return { ok: true, value: undefined };
	}

	async attachFile(): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async listStatuses(key: string, signal?: AbortSignal): Promise<Result<IssueTransition[]>> {
		const card = await this.request<{ idBoard: string }>(
			'GET',
			`/cards/${key}`,
			undefined,
			signal,
			{ fields: 'idBoard' }
		);
		if (!card.ok) return card;
		const lists = await this.request<{ id: string; name: string }[]>(
			'GET',
			`/boards/${card.value.idBoard}/lists`,
			undefined,
			signal,
			{ fields: 'name' }
		);
		if (!lists.ok) return lists;
		return {
			ok: true,
			value: lists.value.map((l) => ({ id: l.id, name: l.name, toStatusName: l.name })),
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
