# Workflow — Local only (no tracker)

The default when nothing is configured. bode stores each task as a markdown file under `<repo>/.bode/tasks/`.

## When to use this

- Solo dev, no team
- Trying bode out before wiring it to Jira / Linear / Issues
- Spike or throwaway work that doesn't need ticket-level visibility
- Air-gapped environments

## Setup

There's nothing to set up. bode falls back to the local adapter automatically when:

- No `tracker:` key is in any config
- No Jira `{site, email, api_token}` triple is set

Force-select it if you want to be explicit:

```yaml
# ~/.bode/config.yml or <repo>/.bode.yml
tracker: local   # or "plain-markdown" — they're aliases
```

## Daily flow

```bash
bode "fix the dashboard ID/name bug"
```

bode mints a key like `local-a3f7b2` and writes `<repo>/.bode/tasks/local-a3f7b2.md` with YAML frontmatter:

```markdown
---
key: local-a3f7b2
status: pending
type: feat
labels: []
created: 2026-05-27T18:30:00Z
updated: 2026-05-27T18:30:00Z
---

# fix the dashboard ID/name bug

Original prompt goes here.
```

Or, name the task explicitly first:

```bash
bode new "fix the dashboard ID/name bug"
# Creates local-a3f7b2 with status: pending. AI is not invoked.
```

Either way, the task file is the source of truth. As bode advances phases, it updates the frontmatter and appends comments under timestamped `### YYYY-MM-DDTHH:MM:SSZ` headings at the bottom of the file.

## Status lifecycle

The `status:` field cycles:

```
pending  →  planning  →  implementing  →  reviewing  →  awaiting-merge  →  done
```

Inspect anytime:

```bash
bode status local-a3f7b2
bode list                  # all tasks tracked locally
```

## Branch naming

bode uses `type:` from the frontmatter:

| `type:` | Prefix |
|---|---|
| `bug` | `fix/` |
| `chore` | `chore/` |
| `refactor` | `refactor/` |
| anything else | `feat/` |

Default is `feat`. To override at creation:

```bash
bode new --type bug "the dashboard explodes on Friday"
```

## Promoting to a real tracker later

If you start local and decide to wire to Jira / Linear / Issues mid-stream:

1. Run `bode setup` and pick the new tracker.
2. Run `bode setup-transitions` to map states.
3. The existing `local-*` tasks **stay local** — they don't auto-migrate. New tasks use the new tracker.

If you really want to back-fill, create the equivalent ticket manually in your tracker and `bode abort local-xxxx && bode start NEW-KEY`.

## Failure modes

Almost none. The local adapter never makes network calls, never needs auth, and never fails on tracker side. The only realistic failure is a filesystem permission issue on `<repo>/.bode/tasks/`.

For deeper details on the file format, see [Trackers → Local / plain-markdown](/trackers/local).
