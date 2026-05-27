import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
	IssueTrackerStrategy,
	IssueTask,
	IssueComment,
	IssueTransition,
} from '~/types/issue-tracker.ts';
import type { Result } from '~/types/result.ts';

const execFileAsync = promisify(execFile);

/**
 * GitHub Issues tracker. Backs `bode <number>` or `bode <owner>/<repo>#<number>`
 * with the user's existing `gh` CLI auth. No additional credentials required —
 * if `gh auth status` shows ok, this adapter works.
 *
 * Status mapping (GitHub Issues only have open/closed, so phases live on labels):
 *
 *   bode phase           → GitHub state + label
 *   ───────────────────────────────────────────────────
 *   planning              open  + bode:planning
 *   implementing          open  + bode:implementing
 *   reviewing             open  + bode:reviewing
 *   awaiting-merge        open  + bode:awaiting-merge
 *   done                  CLOSED
 *
 * Bode labels are managed by addLabel / removeLabel, just as for Jira.
 * transitionStatus('done') closes the issue; any other transition is recorded
 * as a label-only state change.
 */
export class GitHubIssuesAdapter implements IssueTrackerStrategy {
	private readonly workdir: string;

	constructor(options: { workdir: string }) {
		this.workdir = options.workdir;
	}

	/** Strips a leading `#` or trailing fragment, returns the numeric id. */
	private parseKey(key: string): { num: string; repoFlag: string[] } {
		// Accept: `123`, `#123`, `owner/repo#123`
		const slugMatch = key.match(/^([^/\s]+\/[^/\s#]+)#(\d+)$/);
		if (slugMatch?.[1] && slugMatch[2]) {
			return { num: slugMatch[2], repoFlag: ['--repo', slugMatch[1]] };
		}
		const hashMatch = key.match(/^#?(\d+)$/);
		if (hashMatch?.[1]) {
			return { num: hashMatch[1], repoFlag: [] };
		}
		return { num: key, repoFlag: [] };
	}

	private async runGh<T = unknown>(
		args: string[],
		options: { parseJson?: boolean } = {}
	): Promise<Result<T>> {
		try {
			const { stdout } = await execFileAsync('gh', args, { cwd: this.workdir });
			if (options.parseJson) {
				return { ok: true, value: JSON.parse(stdout) as T };
			}
			return { ok: true, value: stdout as unknown as T };
		} catch (e) {
			const err = e as { message?: string; stderr?: string };
			return {
				ok: false,
				error: new Error(
					`gh failed: ${err.stderr?.trim() ?? err.message ?? 'unknown error'}\n` +
						`  Command: gh ${args.join(' ')}`
				),
			};
		}
	}

	async getIssue(key: string): Promise<Result<IssueTask>> {
		const { num, repoFlag } = this.parseKey(key);
		const result = await this.runGh<{
			number: number;
			title: string;
			body: string;
			state: 'OPEN' | 'CLOSED';
			labels: { name: string }[];
			assignees: { login: string }[];
			url: string;
		}>(
			['issue', 'view', num, ...repoFlag, '--json', 'number,title,body,state,labels,assignees,url'],
			{ parseJson: true }
		);

		if (!result.ok) return result;
		const data = result.value;

		const labels = data.labels.map((l) => l.name);
		const bodeStatusLabel = labels.find((l) => l.startsWith('bode:'));
		const status =
			data.state === 'CLOSED'
				? 'done'
				: bodeStatusLabel
					? bodeStatusLabel.slice('bode:'.length)
					: 'pending';

		return {
			ok: true,
			value: {
				key,
				summary: data.title,
				description: data.body ?? '',
				status,
				issueType: inferIssueType(labels),
				assignee: data.assignees[0]?.login ?? null,
				labels,
				url: data.url,
			},
		};
	}

	async addComment(key: string, body: string): Promise<Result<IssueComment>> {
		const { num, repoFlag } = this.parseKey(key);
		const result = await this.runGh(['issue', 'comment', num, ...repoFlag, '--body', body]);
		if (!result.ok) return result;
		return {
			ok: true,
			value: {
				id: `gh-${Date.now()}`,
				body,
				created: new Date().toISOString(),
			},
		};
	}

	async transitionStatus(key: string, transitionName: string): Promise<Result<void>> {
		const { num, repoFlag } = this.parseKey(key);
		const target = transitionName.toLowerCase();

		if (target === 'done' || target === 'closed' || target === 'close') {
			const result = await this.runGh(['issue', 'close', num, ...repoFlag]);
			if (!result.ok) return result;
			return { ok: true, value: undefined };
		}
		// Non-done transitions are pure label changes; the engine already does
		// add/remove via addLabel/removeLabel. Treat this as a no-op so the
		// caller's labelling pipeline owns the state.
		return { ok: true, value: undefined };
	}

	async addLabel(key: string, label: string): Promise<Result<void>> {
		const { num, repoFlag } = this.parseKey(key);
		const result = await this.runGh(['issue', 'edit', num, ...repoFlag, '--add-label', label]);
		if (!result.ok) return result;
		return { ok: true, value: undefined };
	}

	async removeLabel(key: string, label: string): Promise<Result<void>> {
		const { num, repoFlag } = this.parseKey(key);
		const result = await this.runGh(['issue', 'edit', num, ...repoFlag, '--remove-label', label]);
		if (!result.ok) return result;
		return { ok: true, value: undefined };
	}

	async attachFile(_key: string, _filename: string, _content: string): Promise<Result<void>> {
		// GitHub Issues doesn't have a programmatic attach. User can paste a
		// link to the artifact instead. No-op here.
		return { ok: true, value: undefined };
	}

	async getTransitions(_key: string): Promise<Result<IssueTransition[]>> {
		return {
			ok: true,
			value: [
				{ id: 'planning', name: 'Planning', toStatusName: 'planning' },
				{ id: 'implementing', name: 'In Progress', toStatusName: 'implementing' },
				{ id: 'reviewing', name: 'Reviewing', toStatusName: 'reviewing' },
				{ id: 'awaiting-merge', name: 'Awaiting Merge', toStatusName: 'awaiting-merge' },
				{ id: 'done', name: 'Done', toStatusName: 'done' },
			],
		};
	}
}

function inferIssueType(labels: string[]): string {
	const lower = labels.map((l) => l.toLowerCase());
	if (lower.includes('bug')) return 'Bug';
	if (lower.some((l) => l.includes('enhancement') || l.includes('feature'))) return 'Story';
	if (lower.some((l) => l.includes('chore') || l.includes('refactor'))) return 'Task';
	return 'Task';
}

export const __testing = { inferIssueType };
