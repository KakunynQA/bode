# Trackers overview

Bode supports 7 issue trackers + an in-memory mock for tests. Select with `tracker: <kind>` in your config.

| Tracker | Config key | Auth | Status |
|---|---|---|---|
| Jira | `tracker: jira` + `jira.{site, email, api_token}` | Basic auth | Production |
| GitHub Issues | `tracker: github-issues` | uses `gh` CLI auth | Production |
| Linear | `tracker: linear` + `linear.api_key` | API key | Beta |
| Notion | `tracker: notion` + `notion.{api_token, database_id}` | Integration token | Beta |
| Trello | `tracker: trello` + `trello.{api_key, token}` | Key + token | Beta |
| Local | `tracker: local` *(default)* | none | Production |
| plain-markdown | `tracker: plain-markdown` | alias for `local` | Production |

## Selection priority

1. **`force`** (test override).
2. **`tracker:` in project `.bode.yml`** if present.
3. **`tracker:` in global `~/.bode/config.yml`** if present.
4. **Jira** if `jira.site` + `jira.email` + `jira.api_token` are all set.
5. **Local fallback** otherwise.

## Tracker contract

All trackers implement `IssueTrackerStrategy` (see `src/types/issue-tracker.ts`):

```ts
fetchTask(key)              // get the task
postComment(key, body)      // add a comment
setStatus(key, statusName)  // move to a different status / state / list
addTag(key, tag)            // label / tag / multi-select
removeTag(key, tag)
attachFile(key, file, body) // may be no-op
listStatuses(key)           // available statuses for this task
```

The old Jira-flavored names (`getIssue`, `addComment`, `transitionStatus`, `addLabel`, `removeLabel`, `getTransitions`) still work but are deprecated until v0.30.0.
