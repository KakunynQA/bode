# Trackers — Local / plain-markdown

Lives at `src/adapters/tracker/local.ts`. The default when nothing else is configured. Stores each task as a markdown file under `<repo>/.bode/tasks/<key>.md`.

## When this is selected

bode falls back to local when:

- No `tracker:` key is in any config
- No Jira `{site, email, api_token}` triple is set

Force it explicitly with:

```yaml
tracker: local        # or "plain-markdown" — they're aliases
```

## File format

```markdown
---
key: local-a3f7b2
status: planning
type: feat
labels: [bode:planning]
created: 2026-05-27T18:30:00Z
updated: 2026-05-27T18:32:11Z
---

# fix the dashboard ID/name bug

The dashboard collapses ID and name when both are present. We need to show
them as separate columns.

### 2026-05-27T18:30:00Z

🤖 Planning started.

### 2026-05-27T18:32:11Z

🤖 Plan posted:

(truncated plan body)
```

### Frontmatter fields

| Field | Type | Notes |
|---|---|---|
| `key` | string | Auto-generated as `local-<6-char-hash>`. Override at creation with `bode new --key custom-key`. |
| `status` | string | One of: `pending`, `planning`, `implementing`, `reviewing`, `awaiting-merge`, `done`, `aborted`. |
| `type` | string | `feat`, `bug`, `chore`, `refactor`. Drives branch prefix. |
| `labels` | array of strings | Mirrors what the other trackers call tags. |
| `created` / `updated` | ISO-8601 string | Bode maintains these. |

### Body

Whatever you wrote when creating the task (`bode new "..."` or the freeform prompt to `bode "..."`).

### Comments

Appended as `### <ISO-8601>` sections at the bottom of the file. The most recent at the end. bode never edits earlier comments — only appends.

## Task keys

Auto-generated as `local-<6-char-hash>` derived from the timestamp + prompt. Each invocation of `bode new` / `bode "..."` produces a unique key.

You can pass your own:

```bash
bode new --key payments-fix "fix the failing checkout"
```

…and then run `bode start payments-fix`.

## Status lifecycle

```
pending → planning → planned → implementing → implemented
       → reviewing → reviewed → awaiting-merge → done
       (any) → aborted
       (any) → failed
```

Inspect:

```bash
bode list                # all tasks under the local tracker
bode status local-a3f7b2
```

## Branch naming

bode reads `type:` from the frontmatter:

| `type:` | Prefix |
|---|---|
| `bug` | `fix/` |
| `chore` | `chore/` |
| `refactor` | `refactor/` |
| `feat` *(default)* | `feat/` |

Override at task creation:

```bash
bode new --type bug "checkout breaks on Safari"
```

## API contract

Pure filesystem operations — no network, no auth, no failure surface beyond filesystem permissions.

| Method | What it does |
|---|---|
| `fetchTask(key)` | reads `<repo>/.bode/tasks/<key>.md`, parses frontmatter + body |
| `postComment(key, body)` | appends `### <ISO-8601>\n\n<body>\n` |
| `setStatus(key, name)` | rewrites the file with updated `status:` and `updated:` |
| `addTag(key, tag)` / `removeTag(key, tag)` | rewrites the file with updated `labels:` |
| `listStatuses(key)` | returns the static list (`pending`, `planning`, `implementing`, `reviewing`, `awaiting-merge`, `done`) |
| `attachFile(key, path, body)` | appends a `### <ISO-8601> attached <path>` section; doesn't copy the file |

All file writes are atomic (temp file + rename) to match the meta.json discipline.

## When to use local vs a real tracker

**Local is good for:**

- Solo work, no team
- Trying bode out before committing to a tracker integration
- Spikes and throwaway tasks
- Air-gapped environments
- Repos where AI work doesn't need to be visible to non-engineers

**Switch to a real tracker when:**

- Other people need to see what the AI did
- You want PRs auto-linked to tickets
- You want to filter your team's backlog by `bode:*` labels
- You want to enforce a workflow (planning → review → merge) at the team level

You can migrate by setting `tracker:` in config — existing `local-*` tasks stay local; new tasks use the new tracker.

## Failure modes

Effectively none. The local adapter doesn't make network calls. The only realistic failures:

- `EACCES` on `<repo>/.bode/tasks/` — fix file permissions
- `ENOENT` if you `rm`'d the task file by hand — `bode list` will skip it

## What's missing

- **Search across tasks** — bode doesn't have `bode search "checkout"`. Use `grep -r "checkout" .bode/tasks/`.
- **Bulk operations** — no `bode list --done | xargs bode done`. Scripts it yourself or open an issue.
- **Sync to a real tracker** — local-to-Jira migration is manual today (Wave 8+ work if there's demand).
