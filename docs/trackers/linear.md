# Trackers — Linear

Lives at `src/adapters/tracker/linear.ts`. Uses Linear's GraphQL API directly via `fetch` — no SDK dependency.

## Auth

API key from Linear:

1. <https://linear.app/settings/api>
2. **Create new API key**
3. Name it `bode`, copy the key (`lin_api_…`)

Prefer the env var:

```bash
export LINEAR_API_KEY="lin_api_xxx"
```

Or YAML (less secure — stored plaintext in `~/.bode/config.yml`):

```yaml
tracker: linear
linear:
  api_key: lin_api_xxx
```

Env var beats YAML when both are set.

## Task keys

Linear identifier form: `<TEAM>-<NUMBER>`, e.g. `ENG-42`, `GROW-117`. bode resolves the team and workflow automatically from the key — you don't need to pre-configure which teams exist.

## Status mapping

Linear has **workflow states** per team. Each team can have different state names. `setStatus(key, name)` resolves the state by name on the issue's team.

Default mapping if you don't customize:

| bode phase | Linear state name (default) |
|---|---|
| planning | "In Progress" |
| implementation | "In Review" |
| review | "In Review" |
| awaiting_merge | "In Review" |
| done | "Done" |

If your team uses different names ("Doing", "Code Review", "Shipped"), run:

```bash
bode setup-transitions
```

…which lists the team's actual workflow states and lets you pick.

## Labels

Linear has **labels** per team. Important: **the adapter does NOT auto-create labels**. Create your `bode:planning`, `bode:implementing`, etc. labels in Linear once per team (Settings → Labels), then bode applies them automatically.

When a label doesn't exist, the adapter silently no-ops on the label call — the status transition still happens. `bode log <KEY>` shows the warning.

## Comments

`postComment(key, body)` runs the `commentCreate` GraphQL mutation. Linear renders markdown in comments natively.

Truncation at `comment_format.plan_inline_max_chars` applies.

## Branch naming

Linear identifies type via labels or via team configuration. bode currently uses a generic mapping:

| Linear cue | Branch prefix |
|---|---|
| Label includes `bug` | `fix/` |
| Label includes `feature` / `improvement` | `feat/` |
| Label includes `refactor` | `refactor/` |
| (anything else) | `feat/` |

## API contract

GraphQL endpoint: `https://api.linear.app/graphql`. Auth header: `Authorization: <api_key>`.

| Method | GraphQL operation |
|---|---|
| `fetchTask(key)` | `query Issue($id: String!) { issue(id: $id) { id title description state { name } team { id key } labels { nodes { name } } assignee { name } url } }` |
| `postComment(key, body)` | `mutation { commentCreate(input: {issueId, body}) { ... } }` |
| `setStatus(key, name)` | resolves the state ID via team workflow + `issueUpdate(stateId)` |
| `addTag(key, tag)` / `removeTag(key, tag)` | resolves label ID + `issueUpdate(labelIds: ...)` |
| `listStatuses(key)` | `team.states.nodes` |
| `attachFile(...)` | no-op (Linear has attachments but bode doesn't wire it) |

Every call has a 30 s timeout.

## Failure modes

| Symptom | Likely cause |
|---|---|
| `401 Unauthorized` | Bad or revoked API key. Regenerate. |
| `Failed to resolve identifier ENG-42` | Issue doesn't exist, wrong team prefix, or your API key has no access to that team. |
| `State "Doing" not found on team ENG` | Team workflow doesn't have that state. Run `bode setup-transitions`. |
| Labels aren't applied | Labels must exist on the team. Create them in Linear (Settings → Labels). |
| Rate-limited (`429`) | Linear allows ~1500 req/h. bode does not auto-retry. |

## Permissions matrix

Linear API keys are scoped to the user that created them. The user needs:

- Read issues on the relevant teams
- Comment, edit issues, set state, manage labels on those teams

For organization-wide use, create the key under a dedicated bot user with access to all needed teams.

## What's missing

- **Multi-workspace** — bode reads from whichever workspace owns the API key. If your team uses multiple Linear workspaces, you'd need multiple bode profiles (a per-project `linear.api_key` override).
- **Custom views / cycles / projects** — bode interacts with issues only. It doesn't move issues into cycles or projects automatically.
- **Triage moves** — bode doesn't auto-move from a Triage column. The issue must already be in a workflow state your team uses.
