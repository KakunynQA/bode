# Workflow — With Jira

## Setup

```bash
bode setup
```

Pick **Jira** when asked which tracker to use. The wizard collects:

- **Site** — your Atlassian subdomain (e.g. `mycompany.atlassian.net`)
- **Email** — your Atlassian email
- **API token** — created at <https://id.atlassian.com/manage-profile/security/api-tokens>
- **Default project** — Jira project key (e.g. `KD`)

bode tests the connection by fetching a known transition list. On failure it prints the exact error and offers retry.

Result in `~/.bode/config.yml`:

```yaml
tracker: jira
jira:
  site: mycompany.atlassian.net
  default_project: KD
  email: you@company.com
  api_token: ATATT3...
```

## Map your workflow

Jira workflows are project-specific — the same transition can be called "In Progress", "Doing", "Active", or anything else. Run:

```bash
bode setup-transitions
```

bode fetches the available transitions from your Jira project and asks which one corresponds to each bode phase:

- `planning` — when `bode start` begins
- `implementation` — when `bode continue` enters implementation
- `review` — when `bode continue` enters review
- `awaiting_merge` — when the PR is created
- `done` — when `bode done` runs

You can `(skip)` any phase — bode will then leave the Jira state untouched for that event.

This writes to `jira.transitions` in your config:

```yaml
jira:
  transitions:
    planning: "In Progress"
    implementation: "In Review"
    review: "Code Review"
    awaiting_merge: "Awaiting Merge"
    done: "Done"
```

## Daily flow

```bash
bode KD-312           # fetch ticket, create branch, run planning phase
# review the plan that landed as a Jira comment
bode continue KD-312  # implementation
bode continue KD-312  # review
bode continue KD-312  # creates PR, status → awaiting-merge
# someone reviews the PR
bode done KD-312      # back to base, Jira → Done
```

Every phase posts a summary comment to the Jira ticket. The branch URL and PR URL get inlined. Long artifacts are truncated at `comment_format.plan_inline_max_chars` (default 3000) so they fit Jira's field size limits.

## Branch naming by issue type

bode reads the Jira issue type and picks a branch prefix:

| Jira Issue Type | Branch Prefix | Example |
|---|---|---|
| Story | `feat/` | `feat/kd-312` |
| Bug | `fix/` | `fix/kd-100` |
| Task | `chore/` | `chore/kd-200` |
| Improvement | `refactor/` | `refactor/kd-300` |
| Sub-task | `feat/` | `feat/kd-500` |
| Unknown | `feat/` | `feat/kd-400` |

## Labels

bode adds labels to the Jira ticket to advertise state in addition to status:

- `bode:planning` while planning
- `bode:planned` after planning, before implementation
- `bode:implementing` during implementation
- `bode:reviewing` during review
- `bode:awaiting-merge` when PR is open
- `bode:conflict` if a base-branch conflict was detected

Override the names under `jira_labels:` in config.

## Multi-team / multi-project

Jira tickets live in projects. If your default is `KD` but you also work on `GRID` tickets, just pass the full key:

```bash
bode GRID-42
```

bode fetches the ticket regardless of the default project. Per-project overrides (different transitions, different default branch) go in `~/.bode/projects/<name>.yml` or `<repo>/.bode.yml`:

```yaml
name: grid
jira:
  default_project: GRID
  transitions:
    planning: "Doing"   # GRID uses different state names than KD
```

## Failure modes

| Symptom | Likely cause |
|---|---|
| `401 Unauthorized` on first command | Email + API token mismatch. Regenerate at the token page; copy carefully. |
| `Transition X not found` | Your Jira workflow doesn't have that state name. Run `bode setup-transitions` again. |
| Plan didn't post as a comment | Comment posting silently failed — check `~/.bode/runs/<KEY>/<phase>.log` for the 4xx/5xx response body. |
| Ticket fetch returns 404 | Wrong project key, or the ticket doesn't exist. Verify in browser first. |

For deeper details on the Jira adapter itself, see [Trackers → Jira](/trackers/jira).
