import type { JiraAdapter, JiraIssue, JiraComment, JiraTransition } from '~/types/jira.ts';
import type { Result } from '~/types/result.ts';
import { textToAdf, adfToText } from './adf.ts';

const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeJiraSite(site: string): string {
	let s = site.trim();
	if (!/^https?:\/\//i.test(s)) {
		s = `https://${s}`;
	}
	return s.replace(/\/+$/, '');
}

function withTimeout(
	signal: AbortSignal | undefined,
	timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
	const cleanup = () => clearTimeout(timer);
	if (signal) {
		if (signal.aborted) controller.abort();
		else signal.addEventListener('abort', () => controller.abort(), { once: true });
	}
	return { signal: controller.signal, cleanup };
}

export class RealJiraAdapter implements JiraAdapter {
	private site: string;
	private auth: string;
	private timeoutMs: number;

	constructor(site: string, email: string, apiToken: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
		this.site = normalizeJiraSite(site);
		this.auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
		this.timeoutMs = timeoutMs;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
		signal?: AbortSignal
	): Promise<Result<T>> {
		const { signal: timeoutSignal, cleanup } = withTimeout(signal, this.timeoutMs);
		try {
			const url = `${this.site}/rest/api/3${path}`;
			const init: RequestInit = {
				method,
				headers: {
					Authorization: `Basic ${this.auth}`,
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				signal: timeoutSignal,
			};
			if (body !== undefined) init.body = JSON.stringify(body);
			const response = await fetch(url, init);

			if (!response.ok) {
				const text = await response.text().catch(() => '');
				return {
					ok: false,
					error: new Error(`Jira API error ${response.status}: ${text || response.statusText}`),
				};
			}

			if (response.status === 204) {
				return { ok: true, value: undefined as unknown as T };
			}

			const text = await response.text();
			if (!text) return { ok: true, value: undefined as unknown as T };
			const data = JSON.parse(text);
			return { ok: true, value: data as T };
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				return { ok: false, error: new Error('Request timed out') };
			}
			return {
				ok: false,
				error: err instanceof Error ? err : new Error(String(err)),
			};
		} finally {
			cleanup();
		}
	}

	async getIssue(key: string, signal?: AbortSignal): Promise<Result<JiraIssue>> {
		const result = await this.request<{
			key: string;
			fields: {
				summary: string;
				description: unknown;
				status: { name: string };
				issuetype: { name: string };
				assignee: { displayName: string } | null;
				labels: string[];
			};
		}>('GET', `/issue/${key}`, undefined, signal);

		if (!result.ok) return result;
		const issue = result.value;
		const rawDescription = issue.fields?.description;
		const description =
			typeof rawDescription === 'string' ? rawDescription : adfToText(rawDescription).trim();

		return {
			ok: true,
			value: {
				key: issue.key,
				summary: issue.fields?.summary ?? '',
				description,
				status: issue.fields?.status?.name ?? '',
				issueType: issue.fields?.issuetype?.name ?? '',
				assignee: issue.fields?.assignee?.displayName ?? null,
				labels: issue.fields?.labels ?? [],
				url: `${this.site}/browse/${issue.key}`,
			},
		};
	}

	async addComment(key: string, body: string, signal?: AbortSignal): Promise<Result<JiraComment>> {
		const result = await this.request<{ id: string; body: unknown; created: string }>(
			'POST',
			`/issue/${key}/comment`,
			{ body: textToAdf(body) },
			signal
		);

		if (!result.ok) return result;

		const respBody = result.value.body;
		const bodyText = typeof respBody === 'string' ? respBody : adfToText(respBody).trim() || body;

		return {
			ok: true,
			value: {
				id: result.value.id,
				body: bodyText,
				created: result.value.created,
			},
		};
	}

	async transitionStatus(
		key: string,
		transitionName: string,
		signal?: AbortSignal
	): Promise<Result<void>> {
		return this.transitionToStatus(key, transitionName, signal);
	}

	async addLabel(key: string, label: string, signal?: AbortSignal): Promise<Result<void>> {
		return await this.request<void>(
			'PUT',
			`/issue/${key}`,
			{ update: { labels: [{ add: label }] } },
			signal
		);
	}

	async removeLabel(key: string, label: string, signal?: AbortSignal): Promise<Result<void>> {
		return await this.request<void>(
			'PUT',
			`/issue/${key}`,
			{ update: { labels: [{ remove: label }] } },
			signal
		);
	}

	async attachFile(
		_key: string,
		_filename: string,
		_content: string,
		_signal?: AbortSignal
	): Promise<Result<void>> {
		return { ok: true, value: undefined };
	}

	async getTransitions(key: string, signal?: AbortSignal): Promise<Result<JiraTransition[]>> {
		const result = await this.request<{
			transitions: { id: string; name: string; to?: { name?: string } }[];
		}>('GET', `/issue/${key}/transitions`, undefined, signal);

		if (!result.ok) return result;
		const transitions = result.value.transitions;

		if (!Array.isArray(transitions)) {
			return { ok: true, value: [] };
		}

		return {
			ok: true,
			value: transitions.map((t) => {
				const out: JiraTransition = { id: t.id, name: t.name };
				if (t.to?.name) out.toStatusName = t.to.name;
				return out;
			}),
		};
	}

	private async transitionToStatus(
		key: string,
		targetStatusName: string,
		signal?: AbortSignal
	): Promise<Result<void>> {
		const transitions = await this.getTransitions(key, signal);
		if (!transitions.ok) return transitions;

		const transition = transitions.value.find(
			(t) =>
				t.name.toLowerCase() === targetStatusName.toLowerCase() ||
				t.toStatusName?.toLowerCase() === targetStatusName.toLowerCase()
		);
		if (!transition) {
			const available = transitions.value
				.map((t) => `"${t.name}" → "${t.toStatusName ?? '?'}"`)
				.join(', ');
			return {
				ok: false,
				error: new Error(`Transition to "${targetStatusName}" not found. Available: ${available}`),
			};
		}

		return await this.request<void>(
			'POST',
			`/issue/${key}/transitions`,
			{ transition: { id: transition.id } },
			signal
		);
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
}

export async function testJiraConnection(
	site: string,
	email: string,
	apiToken: string,
	signal?: AbortSignal,
	timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Result<void>> {
	const { signal: timeoutSignal, cleanup } = withTimeout(signal, timeoutMs);
	try {
		const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
		const url = `${normalizeJiraSite(site)}/rest/api/3/serverInfo`;
		const init: RequestInit = {
			headers: {
				Authorization: `Basic ${auth}`,
				Accept: 'application/json',
			},
			signal: timeoutSignal,
		};
		const response = await fetch(url, init);

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			return {
				ok: false,
				error: new Error(`Connection failed (${response.status}): ${text || response.statusText}`),
			};
		}

		return { ok: true, value: undefined };
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			return { ok: false, error: new Error('Connection timed out') };
		}
		return {
			ok: false,
			error: err instanceof Error ? err : new Error(String(err)),
		};
	} finally {
		cleanup();
	}
}
