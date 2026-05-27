import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
	IssueTrackerStrategy,
	IssueTask,
	IssueComment,
	IssueTransition,
} from '~/types/issue-tracker.ts';
import type { Result } from '~/types/result.ts';

/**
 * Local file-based tracker. Stores each task at:
 *
 *   <workdir>/.bode/tasks/<key>.md
 *
 * Format: YAML frontmatter (status, labels, timestamps, type) followed by the
 * task body in markdown. Comments are appended as `### YYYY-MM-DDTHH:MM:SSZ`
 * sections at the end of the file.
 *
 * Designed for the case where the user does not have a Jira / Linear / GitHub
 * Issues integration configured but still wants a structured task lifecycle.
 * Status names use the same vocabulary as bode phases (`pending`, `planning`,
 * `implementing`, `reviewing`, `awaiting-merge`, `done`).
 */
export class LocalTrackerAdapter implements IssueTrackerStrategy {
	private readonly tasksDir: string;

	constructor(workdir: string) {
		this.tasksDir = join(workdir, '.bode', 'tasks');
	}

	private taskPath(key: string): string {
		return join(this.tasksDir, `${key}.md`);
	}

	private async readTask(
		key: string
	): Promise<Result<{ frontmatter: TaskFrontmatter; body: string }>> {
		const path = this.taskPath(key);
		if (!existsSync(path)) {
			return {
				ok: false,
				error: new Error(
					`Local task "${key}" not found at ${path}. ` +
						`Create it manually or use \`bode new "<summary>"\` (coming in a future release).`
				),
			};
		}
		try {
			const raw = await readFile(path, 'utf-8');
			const parsed = parseLocalTask(raw);
			if (!parsed.ok) return parsed;
			return { ok: true, value: parsed.value };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
		}
	}

	private async writeTask(
		key: string,
		frontmatter: TaskFrontmatter,
		body: string
	): Promise<Result<void>> {
		try {
			await mkdir(this.tasksDir, { recursive: true });
			const content = serializeLocalTask(frontmatter, body);
			await writeFile(this.taskPath(key), content, 'utf-8');
			return { ok: true, value: undefined };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
		}
	}

	async getIssue(key: string): Promise<Result<IssueTask>> {
		const result = await this.readTask(key);
		if (!result.ok) return result;
		const { frontmatter, body } = result.value;
		return {
			ok: true,
			value: {
				key,
				summary: frontmatter.summary ?? key,
				description: body.trim(),
				status: frontmatter.status ?? 'pending',
				issueType: frontmatter.type ?? 'Task',
				assignee: frontmatter.assignee ?? null,
				labels: frontmatter.labels ?? [],
				url: `file://${this.taskPath(key)}`,
			},
		};
	}

	async addComment(key: string, body: string): Promise<Result<IssueComment>> {
		const result = await this.readTask(key);
		if (!result.ok) return result;
		const { frontmatter, body: existingBody } = result.value;
		const created = new Date().toISOString();
		const newBody = `${existingBody.trimEnd()}\n\n## Comment — ${created}\n\n${body.trim()}\n`;
		frontmatter.updated = created;
		const wr = await this.writeTask(key, frontmatter, newBody);
		if (!wr.ok) return wr;
		return {
			ok: true,
			value: { id: `local-${Date.now()}`, body, created },
		};
	}

	async transitionStatus(key: string, transitionName: string): Promise<Result<void>> {
		const result = await this.readTask(key);
		if (!result.ok) return result;
		const { frontmatter, body } = result.value;
		frontmatter.status = transitionName;
		frontmatter.updated = new Date().toISOString();
		return this.writeTask(key, frontmatter, body);
	}

	async addLabel(key: string, label: string): Promise<Result<void>> {
		const result = await this.readTask(key);
		if (!result.ok) return result;
		const { frontmatter, body } = result.value;
		const labels = new Set(frontmatter.labels ?? []);
		labels.add(label);
		frontmatter.labels = [...labels];
		frontmatter.updated = new Date().toISOString();
		return this.writeTask(key, frontmatter, body);
	}

	async removeLabel(key: string, label: string): Promise<Result<void>> {
		const result = await this.readTask(key);
		if (!result.ok) return result;
		const { frontmatter, body } = result.value;
		frontmatter.labels = (frontmatter.labels ?? []).filter((l) => l !== label);
		frontmatter.updated = new Date().toISOString();
		return this.writeTask(key, frontmatter, body);
	}

	async attachFile(_key: string, _filename: string, _content: string): Promise<Result<void>> {
		// Attachments aren't useful for local tracker; the workdir IS the storage.
		return { ok: true, value: undefined };
	}

	async getTransitions(_key: string): Promise<Result<IssueTransition[]>> {
		return {
			ok: true,
			value: [
				{ id: 'pending', name: 'Pending', toStatusName: 'pending' },
				{ id: 'planning', name: 'In Progress', toStatusName: 'planning' },
				{ id: 'implementing', name: 'In Progress', toStatusName: 'implementing' },
				{ id: 'reviewing', name: 'In Progress', toStatusName: 'reviewing' },
				{ id: 'awaiting-merge', name: 'Code Review', toStatusName: 'awaiting-merge' },
				{ id: 'done', name: 'Done', toStatusName: 'done' },
			],
		};
	}

	/**
	 * Convenience for callers that want to create a brand-new local task
	 * (used by the upcoming `bode new` / `bode <prompt>` fast path).
	 */
	async createTask(
		key: string,
		summary: string,
		options: { description?: string; type?: string; labels?: string[] } = {}
	): Promise<Result<IssueTask>> {
		const now = new Date().toISOString();
		const frontmatter: TaskFrontmatter = {
			summary,
			status: 'pending',
			type: options.type ?? 'Task',
			labels: options.labels ?? [],
			created: now,
			updated: now,
		};
		const body = options.description ?? `# ${summary}\n`;
		const wr = await this.writeTask(key, frontmatter, body);
		if (!wr.ok) return wr;
		return this.getIssue(key);
	}
}

type TaskFrontmatter = {
	summary?: string;
	status?: string;
	type?: string;
	assignee?: string | null;
	labels?: string[];
	created?: string;
	updated?: string;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseLocalTask(raw: string): Result<{ frontmatter: TaskFrontmatter; body: string }> {
	const match = raw.match(FRONTMATTER_RE);
	if (!match || !match[1] || match[2] === undefined) {
		// No frontmatter — treat whole content as body, default frontmatter.
		return { ok: true, value: { frontmatter: {}, body: raw } };
	}
	try {
		const fm = parseYaml(match[1]);
		if (!fm || typeof fm !== 'object') {
			return { ok: true, value: { frontmatter: {}, body: match[2] } };
		}
		return { ok: true, value: { frontmatter: fm as TaskFrontmatter, body: match[2] } };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
	}
}

function serializeLocalTask(frontmatter: TaskFrontmatter, body: string): string {
	const fmYaml = stringifyYaml(frontmatter).trimEnd();
	const trimmedBody = body.trimStart();
	return `---\n${fmYaml}\n---\n\n${trimmedBody}`;
}

export const __testing = { parseLocalTask, serializeLocalTask };
