# CLI commands

Every command supports `--help`.

## Fast path

### `bode <prompt-or-key> [options]`

Routes:

- If `prompt-or-key` looks like a ticket key (`ABC-123`, `123`, `owner/repo#456`, `ENG-42`, Trello shortlink, etc.) → runs `start` on it.
- Otherwise → treats the input as a freeform prompt and creates a local task before starting.

```bash
bode "fix the dashboard bug"
bode KD-312
bode KD-312 --auto
```

| Flag | Description |
|---|---|
| `--project <name>` | Project name from `~/.bode/projects/` |
| `--auto` | Run all phases sequentially until PR created |
| `--dangerously-auto-merge` | Run all phases + merge PR + mark done |
| `--dangerously-approve-all` | Inject each CLI's bypass-approvals flag |

### `bode` *(no args)*

Resumes the latest run.

## Lifecycle

### `bode new <summary...>`

Creates a local task at `<repo>/.bode/tasks/<key>.md` without invoking the AI.

```bash
bode new "wire up the new auth flow"
bode new --type bug "checkout breaks on iOS Safari"
```

| Flag | Description |
|---|---|
| `--project <name>` | Project name from `~/.bode/projects/` |
| `--type <kind>` | Issue type for branch naming (`bug`, `feat`, `chore`, `refactor`) |

### `bode start <KEY> [options]`

Starts a task. Creates the branch, runs the planning phase, posts the plan to the tracker.

| Flag | Description |
|---|---|
| `--project <name>` | Project name from `~/.bode/projects/` |
| `--from-branch <branch>` | Base branch (default: project's `default_branch` or `main`) |
| `--auto` | Run all phases sequentially until PR created |
| `--dangerously-auto-merge` | Run all phases + merge PR + mark done |
| `--dangerously-approve-all` | Inject each CLI's bypass-approvals flag |

### `bode continue <KEY> [options]`

Advances to the next phase. Creates the PR when called from `review`.

| Flag | Description |
|---|---|
| `--project <name>` | Project name from `~/.bode/projects/` |
| `--dangerously-approve-all` | Inject each CLI's bypass-approvals flag |

### `bode abort <KEY> [options]`

Cancels the current execution, cleans up the branch, removes `bode:*` labels/tags.

| Flag | Description |
|---|---|
| `-y, --yes` | Skip the confirmation prompt |

### `bode done <KEY> [options]`

Marks the task done. Switches back to the base branch. Optionally merges the PR.

| Flag | Description |
|---|---|
| `-y, --yes` | Skip the confirmation prompt |
| `--auto-approve-pr-merge` | Automatically merge PR before cleanup |

## Inspection

### `bode status <KEY>`

Prints current phase, branch, PR URL, conflict status.

### `bode show <artifact> <KEY>`

Prints an artifact to stdout. Valid `<artifact>` values: `plan`, `implementation`, `review`.

```bash
bode show plan KD-312
bode show review KD-312 | less
```

### `bode log <KEY>`

Shows the log of the current or last phase. Includes the raw AI output (when headless) or session metadata (when interactive).

### `bode list`

Lists all tasks currently tracked locally. Shows key, branch, phase, conflict flag.

### `bode skills [options]`

Shows resolved skill paths and prompts.

| Flag | Description |
|---|---|
| `--project <name>` | Project name from `~/.bode/projects/` |

## Setup

### `bode setup`

Interactive global wizard. Configures:

- Tracker (Jira / GitHub Issues / Linear / Notion / Trello / local)
- AI CLIs per phase (claude-code / opencode / codex) + model
- VCS provider (GitHub / GitLab)
- Default project (optional)

Tests credentials before writing.

### `bode setup-project`

Per-project wizard. Creates / edits `~/.bode/projects/<name>.yml` (or you can hand-write `<repo>/.bode.yml`). Asks about:

- workdir
- default branch
- per-project tracker override
- context paths and files
- per-phase CLI/model overrides
- per-project hooks

### `bode setup-transitions [options]`

Interactively maps bode phases to your tracker's actual workflow states (or status names, list names, etc.).

```bash
bode setup-transitions
```

| Flag | Description |
|---|---|
| `--project <name>` | Project name from `~/.bode/projects/` |

For each event (`planning`, `implementation`, `review`, `awaiting_merge`, `done`), pick one of the live transitions or `(skip)` to leave the tracker state untouched at that boundary.

## Diagnostics & operations

### `bode doctor`

Checks the environment:

- Node version
- git installed
- AI CLIs found on PATH (and `isAvailable()` for each)
- VCS CLIs (`gh` / `glab`) installed and authenticated
- Tracker credentials valid (does a real round-trip)
- `~/.bode/` is writable
- Project config (if any) parses cleanly

Returns non-zero exit if anything is broken.

### `bode telemetry [subcommand]`

Opt-in anonymous telemetry. Default: OFF.

| Subcommand | What it does |
|---|---|
| `on` | Enable. Generates a local machine UUID if none exists. |
| `off` | Disable. Preserves the machine UUID. |
| `status` | Show current state + machine UUID. |
| `preview` | Show the last 10 events from `~/.bode/telemetry/events.ndjson`. |
| *(none)* | Alias for `status`. |

What gets recorded: command name, success, duration, tracker kind, CLI adapter, versions, machine UUID. **Never** records task content, ticket IDs, code, file paths, or credentials. Stored locally only — no network unless `telemetry.endpoint` is configured (defaults to none).

### `bode compare <KEY> --agents <list> [options]`

Runs the planning phase in **headless** mode against multiple AI CLIs and writes each result + a summary to `~/.bode/comparisons/<KEY>-<timestamp>/`.

```bash
bode compare KD-312 --agents claude-code,codex
bode compare KD-312 --agents claude-code:claude-opus-4-7,codex:gpt-5.5
```

| Flag | Description |
|---|---|
| `--agents <list>` *(required)* | Comma-separated agents. Per-agent model override with `agent:model` syntax. |
| `--project <name>` | Project name from `~/.bode/projects/` |

Planning-phase only today. Full-flow comparison is Wave 8 work (see `ROADMAP.md`).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Generic error (CLI exit non-zero, missing artifact, etc.) |
| 2 | Validation error (bad config, missing required arg, conflicting flags) |
| 3 | Preflight failure (workdir / context_paths / repos[] unreadable) |
| 4 | Tracker error (auth, network, 4xx/5xx) |
| 5 | VCS error (gh/glab missing, auth failure) |
| 130 | Interrupted (Ctrl+C) |

Wave 6 work is making these consistent across all commands; right now some commands collapse 3/4/5 into 1.
