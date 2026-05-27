/**
 * Provider-neutral contract for issue trackers. Implemented by Jira REST,
 * Local markdown, GitHub Issues, and the mock. Future adapters (Linear,
 * Notion, Trello) implement the same interface.
 *
 * **As of v0.25.0** the canonical method names are provider-neutral
 * (`fetchTask`, `postComment`, `setStatus`, `addTag`, `removeTag`,
 * `listStatuses`, `attachFile`). The original Jira-flavored names
 * (`getIssue`, `addComment`, `transitionStatus`, `addLabel`, `removeLabel`,
 * `getTransitions`) are still in the interface but marked `@deprecated`.
 * They will be removed in v0.30.0.
 *
 * Each adapter implements all 13 methods today. Internally most adapters
 * keep the old methods as the source of logic and the new methods as thin
 * delegates — or vice versa. Either pattern works. New code should call only
 * the new names.
 *
 * Contract notes:
 * - `setStatus(key, name)` accepts either a transition NAME (Jira-style
 *   "In Progress") or a target STATUS name ("In Progress" as the column).
 *   Adapters that lack the distinction (Linear, GitHub Issues) treat them
 *   identically.
 * - `addTag` / `removeTag` are tags or list memberships depending on the
 *   tracker. Adapter is free to no-op when the concept doesn't apply.
 * - `attachFile` may be a no-op on trackers that don't support attachments.
 * - `listStatuses` may return an empty array if the provider has no
 *   workflow state concept.
 */

import type { Result } from './result.ts';
import type { JiraIssue, JiraComment, JiraTransition } from './jira.ts';

export type IssueTask = JiraIssue;
export type IssueComment = JiraComment;
export type IssueTransition = JiraTransition;

export interface IssueTrackerStrategy {
	// ─── Canonical, provider-neutral API (v0.25.0+) ───────────────────────

	fetchTask(key: string, signal?: AbortSignal): Promise<Result<IssueTask>>;
	postComment(key: string, body: string, signal?: AbortSignal): Promise<Result<IssueComment>>;
	setStatus(key: string, statusName: string, signal?: AbortSignal): Promise<Result<void>>;
	addTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>>;
	removeTag(key: string, tag: string, signal?: AbortSignal): Promise<Result<void>>;
	attachFile(
		key: string,
		filename: string,
		content: string,
		signal?: AbortSignal
	): Promise<Result<void>>;
	listStatuses(key: string, signal?: AbortSignal): Promise<Result<IssueTransition[]>>;

	// ─── Deprecated aliases (kept until v0.30.0) ───────────────────────────

	/** @deprecated since v0.25.0 — use `fetchTask`. */
	getIssue(key: string, signal?: AbortSignal): Promise<Result<IssueTask>>;
	/** @deprecated since v0.25.0 — use `postComment`. */
	addComment(key: string, body: string, signal?: AbortSignal): Promise<Result<IssueComment>>;
	/** @deprecated since v0.25.0 — use `setStatus`. */
	transitionStatus(
		key: string,
		transitionName: string,
		signal?: AbortSignal
	): Promise<Result<void>>;
	/** @deprecated since v0.25.0 — use `addTag`. */
	addLabel(key: string, label: string, signal?: AbortSignal): Promise<Result<void>>;
	/** @deprecated since v0.25.0 — use `removeTag`. */
	removeLabel(key: string, label: string, signal?: AbortSignal): Promise<Result<void>>;
	/** @deprecated since v0.25.0 — use `listStatuses`. */
	getTransitions(key: string, signal?: AbortSignal): Promise<Result<IssueTransition[]>>;
}

export type { Result };
