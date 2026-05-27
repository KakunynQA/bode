/**
 * Provider-neutral contract for issue trackers. Today implemented by the Jira
 * REST adapter and the mock. Future adapters (GitHub Issues, Linear, Notion,
 * Trello, local markdown) implement the same interface.
 *
 * Method names are intentionally generic ("fetchTask" not "getIssue") so the
 * abstraction reads cleanly across providers. For backward compatibility, the
 * legacy `JiraAdapter` interface in `./jira.ts` is preserved as a structural
 * alias — same shape, different name.
 *
 * Contract notes:
 * - `transitionStatus(key, name)` accepts either a transition NAME (Jira-style
 *   "In Progress") or a target STATUS name ("In Progress" as the column).
 *   Adapters that lack the distinction (Linear, GitHub Issues) treat them as
 *   the same.
 * - `addLabel` / `removeLabel` are tags or list memberships depending on the
 *   tracker. Adapter is free to no-op when the concept doesn't apply.
 * - `attachFile` may be a no-op on trackers that don't support attachments.
 * - `getTransitions` may return an empty array if the provider has no
 *   workflow state concept.
 *
 * See ROADMAP.md and GitHub issue #5 for the planned rename cycle.
 */

import type { Result } from './result.ts';
import type { JiraAdapter, JiraIssue, JiraComment, JiraTransition } from './jira.ts';

export type IssueTask = JiraIssue;
export type IssueComment = JiraComment;
export type IssueTransition = JiraTransition;

export type IssueTrackerStrategy = JiraAdapter;

export type { Result };
