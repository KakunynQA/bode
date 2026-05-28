# Run artifacts

Everything bode writes during a task lives under `~/.bode/runs/<KEY>/`. This page documents the layout and lifecycle of each file.

## Directory layout

```
~/.bode/runs/<KEY>/
├── meta.json              # task metadata, current phase, branch, PR, timestamps, conflict flag
├── lock.json              # active-run lockfile (created on start, removed on done/abort)
├── branch.txt             # branch name written by the AI during planning/implementation
├── pr.txt                 # PR URL written by the AI during the pr phase
├── planning.log           # raw output from the AI CLI (headless mode only)
├── planning.md            # the planning artifact (markdown)
├── implementation.log
├── implementation.md
├── review.log
└── review.md
```

For comparison runs (`bode compare`):

```
~/.bode/comparisons/<KEY>-<timestamp>/
├── claude-code__planning.md
├── codex__planning.md
└── summary.md
```

## `meta.json`

```jsonc
{
  "key": "KD-312",
  "type": "feat",
  "branch": "feat/kd-312",
  "base_branch": "main",
  "phase": "reviewing",
  "tracker": "jira",
  "pr_url": "https://github.com/myorg/myrepo/pull/42",
  "conflict": false,
  "created_at": "2026-05-27T18:30:00Z",
  "updated_at": "2026-05-27T19:15:33Z",
  "workdir": "/home/user/projects/myrepo",
  "project": "grid",
  "auto_mode": false,
  "dangerous_bypass": false
}
```

### Phase values

```
pending → planning → planned → implementing → implemented
       → reviewing → reviewed → awaiting-merge → done
       (any) → aborted
       (any) → failed
```

Bode writes meta.json atomically: temp file + `rename()`. Crashes never produce partial state (v0.19.0).

## `lock.json`

```json
{
  "pid": 12345,
  "started_at": "2026-05-27T18:30:00Z",
  "host": "rofli-mbp"
}
```

Created on `bode start`. Removed on `bode done` or `bode abort`. If a stale lock exists (PID no longer running), bode prints a warning and lets you proceed after confirmation.

Lockfiles prevent two `bode start KD-312` invocations from clobbering each other (v0.19.0).

## `<phase>.md`

The artifact for each phase. Written by the AI CLI per the skill's instructions; read by bode after the session exits.

| Phase | Typical content |
|---|---|
| `planning.md` | Goal, Approach, Files to modify, Risks, Tests needed |
| `implementation.md` | Summary of changes, files touched, validation results |
| `review.md` | Verdict (APPROVE / REQUEST_CHANGES), issues found, suggestions |

Used as context for the next phase. Also posted (truncated) as a tracker comment.

If the file is missing or empty when the AI exits, bode shows the interactive `[retry | continue | abort]` prompt.

## `<phase>.log`

The raw stdout/stderr from the AI CLI. Populated only when bode runs in **headless** mode (i.e. under `--auto`). In interactive mode the user sees the session live in their terminal — there's nothing to capture, so the log file is empty or absent.

Used for forensic debugging:

```bash
bode log KD-312          # prints the last phase's log
cat ~/.bode/runs/KD-312/implementation.log
```

## `branch.txt`

Set during the planning phase. The AI CLI writes the branch name here (one line, no trailing newline) after running `git checkout -b` itself. bode reads it to learn what branch was created without having to introspect git state.

Format: `feat/kd-312` (just the branch name, no `refs/heads/` prefix).

## `pr.txt`

Set during the PR phase. The AI CLI writes the PR URL here after running `gh pr create` / `glab mr create`. bode reads it for:

- The `bode status` output
- The `bode done --auto-approve-pr-merge` merge call
- The tracker summary comment

Format: a single URL line (`https://github.com/myorg/myrepo/pull/42`).

## Local task file (`<repo>/.bode/tasks/<KEY>.md`)

When using the local tracker, this file IS the tracker. YAML frontmatter on top, markdown body, comments appended at the bottom under timestamped headings.

```markdown
---
key: local-a3f7b2
status: implementing
type: feat
labels: [bode:implementing]
created: 2026-05-27T18:30:00Z
updated: 2026-05-27T18:42:11Z
---

# fix the dashboard ID/name bug

Original task description.

### 2026-05-27T18:30:00Z

🤖 Planning started.

### 2026-05-27T18:35:00Z

🤖 Plan posted:

(truncated plan body)
```

## Cleanup

bode does not auto-delete artifacts. To clean up:

```bash
# Single task
bode abort KD-312       # removes lock, resets branch — does NOT delete artifacts
rm -rf ~/.bode/runs/KD-312

# All artifacts older than 90 days
find ~/.bode/runs -mindepth 1 -maxdepth 1 -type d -mtime +90 -exec rm -rf {} \;

# Comparison runs
rm -rf ~/.bode/comparisons
```

Wave 6 work includes adding `bode runs prune --older-than 90d` so you don't need to script it.

## Privacy

Run artifacts contain everything the AI saw and produced — which can include source code, ticket bodies, configuration values, commit messages, etc. They are stored **locally only** under `~/.bode/runs/`. bode does not upload them anywhere.

Telemetry (opt-in) is recorded separately at `~/.bode/telemetry/events.ndjson` and is strictly metadata — never artifact content. See [Reference → CLI commands → `bode telemetry`](./cli#bode-telemetry-subcommand).
