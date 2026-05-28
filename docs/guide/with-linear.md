# Workflow — With Linear

## Setup

Get an API key from Linear:

1. Go to <https://linear.app/settings/api>
2. Click **Create new API key**
3. Name it `bode` and copy the key (starts with `lin_api_…`)

Set it as an env var (recommended) or put it in config:

```bash
export LINEAR_API_KEY="lin_api_xxx"
```

Or in `~/.bode/config.yml`:

```yaml
tracker: linear
linear:
  api_key: lin_api_xxx
```

Env var takes precedence. The bode setup wizard offers either option.

## Daily flow

```bash
bode ENG-42          # fetch the Linear issue, create branch, plan
bode continue ENG-42 # implementation
bode continue ENG-42 # review
bode continue ENG-42 # PR
bode done ENG-42     # mark done in Linear
```

Linear keys are the team prefix + number (e.g. `ENG-42`, `GROW-117`). bode resolves the team and workflow automatically from the key.

## Status mapping

Linear has **workflow states** per team (Backlog, Todo, In Progress, In Review, Done, etc.). bode's `setStatus(key, name)` resolves the state by name on the issue's team.

Default mapping bode uses if you don't customize via `bode setup-transitions`:

| bode phase | Linear workflow state |
|---|---|
| planning | "In Progress" |
| implementation | "In Review" |
| review | "In Review" |
| awaiting_merge | "In Review" |
| done | "Done" |

Linear teams that use different state names: run `bode setup-transitions` and bode will list what your team actually has, so you can pick.

## Labels

Linear has **labels** (per-team, must exist before assignment — the adapter does NOT auto-create them). Create your `bode:planning`, `bode:implementing`, etc. labels in Linear once per team, then bode applies them automatically.

If a label doesn't exist, the adapter silently no-ops on the label call (the status transition still happens). Run `bode log <KEY>` to see warnings.

## Branch naming

Linear identifies issue type via the "Label" or via the team configuration. bode currently uses a generic mapping:

| Linear cue | Branch prefix |
|---|---|
| Label includes `bug` | `fix/` |
| Label includes `feature` / `improvement` | `feat/` |
| Label includes `refactor` | `refactor/` |
| (anything else) | `feat/` |

You can override per-project by editing `branchPrefix:` in the project config (Wave 6 work; tracked in #36).

## Failure modes

| Symptom | Likely cause |
|---|---|
| `Linear API: 401` | Bad or revoked API key. Regenerate at <https://linear.app/settings/api>. |
| `State "Doing" not found on team ENG` | The team's workflow doesn't have that state. Run `bode setup-transitions`. |
| Labels aren't applied | Labels must exist on the team. Create them manually in Linear (Settings → Labels). |
| `Failed to resolve identifier ENG-42` | Either the issue doesn't exist, the team prefix is wrong, or your API key doesn't have access to that team's workspace. |

For deeper details, see [Trackers → Linear](/trackers/linear).
