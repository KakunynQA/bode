# Trackers — Jira

The original tracker. Lives at `src/adapters/jira/rest.ts` + `src/adapters/jira/adf.ts` for Atlassian Document Format helpers.

## Auth

Basic Auth with email + API token. Stored in config as plaintext (be careful about file permissions on `~/.bode/config.yml`):

```yaml
tracker: jira
jira:
  site: mycompany.atlassian.net
  default_project: KD
  email: you@company.com
  api_token: ATATT3...
```

Get the token at <https://id.atlassian.com/manage-profile/security/api-tokens>.

The site key accepts both `mycompany.atlassian.net` and `https://mycompany.atlassian.net` — bode normalizes via `normalizeJiraSite()`.

## Task keys

Standard Jira keys: `<PROJECT>-<NUMBER>`, e.g. `KD-312`, `GRID-42`.

bode does not require the key to belong to `default_project` — any key the credentials can see works.

## Status transitions

Jira workflows are project-specific. bode does not assume status names. Run:

```bash
bode setup-transitions
```

…to map each bode event (planning / implementation / review / awaiting_merge / done) to one of your project's real transitions. The result lands in `jira.transitions`:

```yaml
jira:
  transitions:
    planning: "In Progress"
    implementation: "In Review"
    review: "Code Review"
    awaiting_merge: "Awaiting Merge"
    done: "Done"
```

Each field can be omitted (`(skip)` in the interactive picker) to leave the Jira state untouched at that boundary.

`setStatus(key, name)` resolves the transition by destination state name on each call. If the workflow changes, bode picks up the new state next run.

## Labels / tags

`addTag(key, tag)` adds a Jira label. bode applies its own phase labels by default (`bode:planning`, `bode:implementing`, etc.); override the names under `jira_labels:` in config.

Labels are flat strings in Jira — no namespacing constraint. Bode's convention is `bode:<phase>` to make team-wide filtering easy.

## Comments

`postComment(key, body)` posts a Jira comment in Atlassian Document Format (ADF). bode renders markdown to ADF via `src/adapters/jira/adf.ts` so headings, code blocks, lists, and links render natively in the Jira UI.

Long artifacts are truncated at `comment_format.plan_inline_max_chars` (default 3000) to fit Jira's payload limits.

## Branch naming

bode reads `issueType` from the Jira ticket:

| Jira Issue Type | Branch Prefix |
|---|---|
| Story | `feat/` |
| Bug | `fix/` |
| Task | `chore/` |
| Improvement | `refactor/` |
| Sub-task | `feat/` |
| Unknown | `feat/` |

Branch names are lowercased: `KD-312` Bug → `fix/kd-312`.

## API contract

The Jira adapter is the reference implementation of `IssueTrackerStrategy` (see `src/types/issue-tracker.ts`). Methods:

| Method | Jira call |
|---|---|
| `fetchTask(key)` | `GET /rest/api/3/issue/{key}` |
| `postComment(key, body)` | `POST /rest/api/3/issue/{key}/comment` |
| `setStatus(key, name)` | `GET .../transitions` + `POST .../transitions` |
| `addTag(key, tag)` / `removeTag(key, tag)` | `PUT .../issue/{key}` with `labels: [{add\|remove}]` |
| `listStatuses(key)` | `GET .../transitions` |
| `attachFile(key, path)` | `POST .../issue/{key}/attachments` |

Every call has a 30 s timeout (`DEFAULT_TIMEOUT_MS` in the adapter source).

## Failure modes

| Symptom | Likely cause |
|---|---|
| `401 Unauthorized` | Email or token wrong / revoked. Regenerate at the token page. |
| `403 Forbidden` | Token works but lacks access to that project. Ask your Jira admin. |
| `Transition <name> not found` | Workflow doesn't have that destination state. Run `bode setup-transitions` to remap. |
| `400 Invalid label name` | Some Jira instances forbid colons in labels. Override `jira_labels:` to use a different separator (e.g. `bode-planning`). |
| `429 Too Many Requests` | Atlassian rate limit. bode does not auto-retry; wait a minute. |

## Permissions matrix

The bode user / token needs:

- `BROWSE_PROJECTS` (read tickets)
- `WORK_ON_ISSUES` (add comments, transition status)
- `EDIT_ISSUES` (set labels)
- `CREATE_ATTACHMENTS` (only if you use `attachFile` — bode itself doesn't today, but skills might)

## What's missing

- **Custom fields** — bode doesn't read or write any custom field today. Wave 8+ work if there's demand.
- **Sub-task creation** — bode treats sub-tasks as regular tickets. It doesn't break a parent task into sub-tasks automatically.
- **Sprint assignment** — bode doesn't manage sprints.
- **OAuth** — only Basic Auth + API token. OAuth 2.0 (3LO) is Wave 9+ work.

These are conscious omissions, not oversights. Open an issue if you need one.
