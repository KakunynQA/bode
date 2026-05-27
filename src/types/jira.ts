/**
 * Jira-specific issue types. The interface `JiraAdapter` is now a structural
 * alias for `IssueTrackerStrategy` (which has both old and new method names).
 * Kept for any external consumer that imports from this module by path.
 *
 * @deprecated since v0.25.0 — prefer `IssueTrackerStrategy` from
 * `~/types/issue-tracker.ts`. This re-export will remain through v0.29.x.
 */

export type JiraIssue = {
	key: string;
	summary: string;
	description: string;
	status: string;
	issueType: string;
	assignee: string | null;
	labels: string[];
	url: string;
};

export type JiraComment = {
	id: string;
	body: string;
	created: string;
};

export type JiraTransition = {
	id: string;
	name: string;
	toStatusName?: string;
};

/** @deprecated since v0.25.0 — use `IssueTrackerStrategy`. */
export type JiraAdapter = import('./issue-tracker.ts').IssueTrackerStrategy;
