# Bode — Technical Specification (v1.0.0)

## What Bode Is

Bode is a local CLI that orchestrates AI coding work through configurable phases (planning, implementation, review, PR creation), driving native AI CLIs (Claude Code, OpenCode, Codex) and syncing progress to whichever issue tracker the team uses (Jira, GitHub Issues, Linear, Notion, Trello) or to local markdown tasks when no tracker is configured. Z.AI's GLM models are reached through any of the AI CLI adapters by running `npx @z_ai/coding-helper init` once.

## What Bode Is Not

- Not a dashboard. The tracker (Jira / Linear / Issues / etc.) is the source of truth for team-wide visibility.
- Not an autonomous agent. Developers pull tasks explicitly via `bode start` / `bode <prompt>`.
- Not a CLI wrapper. Each phase runs its own configured AI CLI; bode is the orchestrator above them.
- Not a 24/7 daemon. bode runs when invoked.

## Core Workflow

```
Developer picks up KD-312 (status: To Do)
  │
  ▼
$ bode start KD-312          (or: bode KD-312, or: bode "fix the bug")
  │
  ├─ Validates task exists, fetches details
  ├─ Creates git branch (feat/kd-312) from base branch
  ├─ Pushes branch to origin
  ├─ Tracker: setStatus → "In Progress" (or configured equivalent)
  ├─ Tracker: postComment → "🤖 Planning started"
  ├─ Runs pre_planning hooks
  ├─ Hands terminal to configured AI CLI for the planning phase
  ├─ Saves plan to ~/.bode/runs/KD-312/planning.md
  ├─ Runs post_planning hooks
  ├─ Posts plan summary as tracker comment
  └─ Exits. Developer reviews plan.

$ bode continue KD-312
  │
  ├─ Validates current phase
  ├─ Tracker: setStatus → next configured state
  ├─ pre_<phase> hooks, AI session, artifact, post_<phase> hooks
  ├─ If implementation: branch conflict check, AI creates PR via gh/glab
  └─ Exits. Developer reviews PR.

$ bode done KD-312
  │
  ├─ Optionally merges PR (--auto-approve-pr-merge)
  ├─ Switches to base branch
  ├─ Tracker: setStatus → "Done"
  ├─ Removes "bode:*" labels/tags
  └─ Posts completion comment
```

## Autopilot / Auto mode

### `--auto`

```bash
bode start KD-312 --auto
bode KD-312 --auto
bode "fix the bug" --auto
```

Runs planning → implementation → review → PR creation sequentially without gates. Stops after PR is created so the human can review.

### `--dangerously-auto-merge`

```bash
bode start KD-312 --dangerously-auto-merge
```

Same as `--auto` plus auto-merges the PR and marks done. Prints a prominent warning before proceeding.

### `--dangerously-approve-all`

```bash
bode start KD-312 --dangerously-approve-all
bode continue KD-312 --dangerously-approve-all
```

Passes each AI CLI's bypass-approvals/sandbox flag automatically. Per-adapter mapping:

| Adapter | Flag injected |
|---|---|
| `claude-code` | `--dangerously-skip-permissions` |
| `codex` | `--dangerously-bypass-approvals-and-sandbox` |
| `opencode` | (none — bode warns upfront) |

## Tech Stack

- **Language:** TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Runtime:** Node.js >=20, single CJS bundle built with esbuild → `dist/index.js`; also distributed as standalone single-file executables via Node SEA (`scripts/build-sea.mjs`)
- **CLI framework:** `commander`
- **Interactive prompts:** `@inquirer/prompts`
- **Trackers:** Jira REST v3 + ADF helpers; Linear GraphQL; Notion REST; Trello REST; GitHub Issues via `gh` CLI; local markdown
- **AI CLIs:** `child_process` via `CliAdapter` interface (interactive `stdio: 'inherit'` by default; headless capture for `--auto`)
- **VCS:** `gh` (GitHub) or `glab` (GitLab) — the AI creates branches and PRs itself via its own tool calls; bode only invokes the VCS CLI for `setup` detection and optional `done` merge
- **Local storage:** filesystem (`~/.bode/`), no DB
- **Config:** YAML (`~/.bode/config.yml` + `~/.bode/projects/<name>.yml` + `<repo>/.bode.yml`)
- **Skill prompts:** Markdown (`<repo>/.bode/skills/`, `~/.bode/skills/`, bundled defaults)
- **Hooks:** Shell commands wired to phase lifecycle points
- **Tests:** `node --test` via `tsx` (cross-platform runner at `scripts/test.mjs`)
- **Telemetry:** Opt-in NDJSON at `~/.bode/telemetry/events.ndjson`
- **Build:** esbuild → `dist/index.js` (CJS), static assets embedded via `define`
- **ASCII art:** `src/assets/bode.art` embedded at build time as `__GOAT_ART__`

## Strategy Architecture

Three strategy layers form the public extensibility surface. Each can absorb new providers without touching the orchestrator.

### 1. `CliAdapter` — AI CLIs

Interface: `src/types/cli-adapter.ts`. Implementations: `ClaudeCodeAdapter`, `OpenCodeAdapter`, `CodexAdapter`. Registry: `src/adapters/cli/registry.ts`. Models per CLI: `src/adapters/cli/models.ts`.

Contract:
- `invoke(prompt, config, options)` — interactive or headless; optional `dangerousBypass` and `workdir`
- `isAvailable()` — feature-detection during `setup`
- `dangerousFlags()` — the CLI's bypass-approvals flag, or `null`

### 2. `VcsAdapter` — Branch / PR providers

Interface: `src/types/vcs.ts`. Implementations: `GitHubAdapter` (shells to `gh`), `GitLabAdapter` (shells to `glab`). Factory: `src/adapters/vcs/factory.ts`.

Since v0.16.0 the AI creates the PR itself. This layer is used by `bode done` (merge) and `bode setup` (remote detection).

### 3. `IssueTrackerStrategy` — Issue trackers

Interface: `src/types/issue-tracker.ts` (canonical) / `src/types/jira.ts` (deprecated alias kept through v0.29.x). Implementations:

| Adapter | File | Notes |
|---|---|---|
| `MockJiraAdapter` | `src/adapters/jira/mock.ts` | No-op for tests / unconfigured |
| `RealJiraAdapter` | `src/adapters/jira/rest.ts` | Jira REST v3, ADF body, 30 s timeout |
| `GitHubIssuesAdapter` | `src/adapters/tracker/github-issues.ts` | Uses `gh` CLI auth |
| `LinearAdapter` | `src/adapters/tracker/linear.ts` | GraphQL via `fetch`, API key |
| `NotionAdapter` | `src/adapters/tracker/notion.ts` | REST, integration token, database-backed |
| `TrelloAdapter` | `src/adapters/tracker/trello.ts` | REST, key + token, board-backed |
| `LocalTrackerAdapter` | `src/adapters/tracker/local.ts` | Markdown files at `<repo>/.bode/tasks/` |

**Canonical method names (v0.25.0+):** `fetchTask`, `postComment`, `setStatus`, `addTag`, `removeTag`, `listStatuses`, `attachFile`. Old Jira-flavored names (`getIssue`, `addComment`, `transitionStatus`, `addLabel`, `removeLabel`, `getTransitions`) still work; removal in v0.30.0.

Selection logic in `src/adapters/tracker/factory.ts`:

1. `force` (test override)
2. `tracker:` in project `.bode.yml`
3. `tracker:` in global `~/.bode/config.yml`
4. Jira if `jira.{site, email, api_token}` all set
5. `LocalTrackerAdapter` fallback

## Directory Layout

### User home

```
~/.bode/
├── config.yml              # global config
├── projects/               # per-project configs
│   ├── grid.yml
│   └── api.yml
├── runs/
│   └── <KEY>/
│       ├── meta.json       # task metadata, branch, PR, phase, timestamps
│       ├── branch.txt      # branch name written by AI
│       ├── pr.txt          # PR URL written by AI
│       ├── planning.log    # raw output (only when headless)
│       ├── planning.md     # extracted plan
│       ├── implementation.log
│       ├── implementation.md
│       ├── review.log
│       └── review.md
├── skills/                 # custom skill prompts
├── telemetry/              # opt-in event log (NDJSON)
│   └── events.ndjson
└── comparisons/            # bode compare output
    └── <KEY>-<timestamp>/
```

### Per-repo

```
<repo>/
├── .bode.yml               # repo-scoped config (preferred over ~/.bode/projects/)
└── .bode/
    ├── tasks/              # local tracker (when no external tracker configured)
    │   └── <KEY>.md
    ├── skills/             # repo-scoped skills (override global/bundled)
    │   ├── planning.md
    │   ├── implementation.md
    │   └── review.md
    └── hooks/              # repo-scoped hook scripts
```

## Configuration Schema

Defined in `src/config/schema.ts` (Zod).

### `~/.bode/config.yml` (global)

```yaml
tracker: jira                 # jira | github-issues | linear | notion | trello | local | plain-markdown | mock

jira:
  site: mycompany.atlassian.net
  default_project: KD
  email: you@company.com
  api_token: your-api-token
  transitions:                # optional — bode setup-transitions writes these
    planning: "In Progress"
    implementation: "In Review"
    review: "Code Review"
    awaiting_merge: "Awaiting Merge"
    done: "Done"

linear:
  api_key: lin_api_xxx        # or set LINEAR_API_KEY

notion:
  api_token: secret_xxx       # or set NOTION_TOKEN
  database_id: 00000000-0000-0000-0000-000000000000
  properties:                 # optional — override defaults
    title: "Name"
    status: "Status"
    tags: "Tags"

trello:
  api_key: xxx                # or set TRELLO_KEY
  token: xxx                  # or set TRELLO_TOKEN
  board_id: xxx               # optional pin

vcs:
  provider: github            # github | gitlab

github:
  default_org: kakunyn

phases:
  planning:
    cli: claude-code
    model: claude-opus-4-7
    skill: ~/.bode/skills/planning.md
    timeout_minutes: 15
  implementation:
    cli: opencode
    model: claude-sonnet-4-6
    skill: ~/.bode/skills/implementation.md
    timeout_minutes: 60
  review:
    cli: opencode
    model: claude-sonnet-4-6
    skill: ~/.bode/skills/review.md
    timeout_minutes: 10

gates:
  after_planning: true
  after_implementation: true

defaults:
  project: grid

jira_labels:                  # historical name; applies to any tracker that supports tags
  planning: bode:planning
  planned: bode:planned
  implementing: bode:implementing
  reviewing: bode:reviewing
  reviewed: bode:reviewed
  autopilot: bode:autopilot

comment_format:
  plan_inline_max_chars: 3000
  use_emoji: true

hooks:
  pre_implementation:
    - npm run lint:fix
  post_review:
    - run: ./.bode/hooks/notify.sh
      non_blocking: true
```

### `~/.bode/projects/<name>.yml` or `<repo>/.bode.yml`

```yaml
name: grid
workdir: /home/user/projects/grid-stack
default_branch: main

tracker: github-issues         # override global tracker for this project

jira:
  site: mycompany.atlassian.net
  default_project: GRID

vcs_provider: github

context_paths:
  - .
  - ../grid-ui/src

context_files:
  - AGENTS.md
  - CLAUDE.md

phases:
  implementation:
    model: claude-opus-4-7

repos:                          # multi-repo support
  - workdir: /home/user/projects/grid-api
    name: api
  - workdir: /home/user/projects/grid-ui
    name: ui

branch_tool: gh                 # rarely overridden

hooks:
  pre_planning:
    - ./bin/sync-design-tokens
```

### Resolution order

1. Project: `~/.bode/projects/<name>.yml`
2. Repo: `<repo>/.bode.yml`
3. Global: `~/.bode/config.yml`
4. Defaults baked into `src/config/loader.ts`

## CLI Commands

| Command | What it does |
|---|---|
| `bode <prompt-or-key>` | Fast path. Routes to `start` for ticket keys; creates local task for freeform prompt. |
| `bode` *(no args)* | Resume the latest run. |
| `bode new <summary>` | Create local task at `.bode/tasks/<key>.md` without invoking the AI. |
| `bode setup` | Interactive global wizard (tracker, AI CLIs, VCS). |
| `bode setup-project` | Per-project wizard (workdir, default branch, context, overrides). |
| `bode setup-transitions` | Map bode phases to your tracker's workflow states. |
| `bode start <KEY>` | Start a task. Creates branch, runs planning phase. Add `--strict` for Wave 6 gates. |
| `bode init` | Scaffold `AGENTS.md` for the current repo via the configured AI CLI. |
| `bode learn` | Generate `<repo>/.bode/context.md` for future phase prompts. |
| `bode continue <KEY>` | Advance to next phase. Creates PR at awaiting-merge. |
| `bode status <KEY>` | Show current phase, branch, PR link, conflict status. |
| `bode show <artifact> <KEY>` | Print artifact (`plan` / `implementation` / `review`) to stdout. |
| `bode log <KEY>` | Show the log of the current or last phase. |
| `bode list` | List all locally tracked tasks. |
| `bode abort <KEY>` | Cancel execution, clean up branch, reset tracker state. |
| `bode done <KEY>` | Mark done. Switch to base. Optionally merge PR. |
| `bode skills` | Show resolved skill paths and prompts. |
| `bode doctor` | Diagnose env, config, AI CLIs, VCS tooling. |
| `bode telemetry [on\|off\|status\|preview]` | Opt-in anonymous telemetry control. |
| `bode compare <KEY> --agents <list>` | Run planning across multiple agents headlessly and compare. |

### Flags

| Flag | Command(s) | Description |
|---|---|---|
| `--project <name>` | start, continue, fast path, compare, setup-transitions | Project name from `~/.bode/projects/` |
| `--from-branch <branch>` | start | Base branch (default: project's `default_branch` or `main`) |
| `--auto` | start, fast path | Run all phases sequentially until PR created |
| `--strict` | start, fast path | Enable plan-review contract checks, validation gate, and release gate |
| `--dangerously-auto-merge` | start, fast path | Run all phases + merge PR + mark done |
| `--dangerously-approve-all` | start, continue, fast path | Pass each CLI its bypass-approvals/sandbox flag |
| `--auto-approve-pr-merge` | done | Automatically merge PR before cleanup |
| `--agents <list>` | compare | Comma-separated agents (e.g. `claude-code,codex` or `claude-code:claude-opus-4-7,codex:gpt-5.5`) |
| `-y, --yes` | abort, done | Skip confirmation |

## Phase Execution Detail

Each phase follows the same pattern (in `src/orchestrator/phase-runner.ts`):

1. **Preflight** (`src/orchestrator/preflight.ts`): verify `workdir`, every `context_paths[]`, and every `repos[].workdir` is readable. Abort with structured error if not.
2. **Pre-hooks**: run `pre_<phase>` shell commands in order. Non-zero exit aborts unless `non_blocking: true`.
3. **Tracker transition**: `setStatus` → configured state (see `src/config/transitions.ts`).
4. **Tracker comment**: posts "Phase started" message.
5. **Build prompt**: skill template + tracker ticket + project rules + file tree + prior artifact + `<bode-handoff>` block instructing the AI where to write the final markdown.
6. **Untrusted content guard**: ticket body wrapped in `<untrusted>` markers (v0.18.0); bundled skills include defensive instructions.
7. **Invoke AI CLI**: interactive (`stdio: 'inherit'`) by default; headless capture when `--auto`. Hands the terminal over.
8. **Artifact read**: after CLI exits, reads `~/.bode/runs/<KEY>/<phase>.md`. If missing/empty → `[retry | continue | abort]` prompt.
9. **Exit code gate** (v0.20.0): non-zero CLI exit marks phase failed regardless of artifact presence.
10. **Post-hooks**: `post_<phase>` shell commands.
11. **Tracker summary comment**: posts the artifact (truncated at `plan_inline_max_chars`).
12. **Update meta atomically**: temp file + rename to avoid partial state (v0.19.0).

### Context gathering

`src/config/context.ts` builds the context block injected into the prompt:

1. Reads `<repo>/.bode/context.md` when present (`bode learn` output).
2. Reads every `context_files` entry relative to `workdir`.
3. Generates a file tree for each `context_paths[]` (excludes `node_modules/`, `.git/`, `dist/`).
4. Includes prior phase artifacts (planning.md → plan-review → implementation → review).
5. Wraps untrusted tracker content in `<untrusted>` markers.

### CLI invocation matrix

| CLI | Interactive | Headless |
|---|---|---|
| claude-code | `claude --model <model> "<prompt>"` | `claude --print --model <model> < prompt.txt` |
| opencode | `opencode --model <model> "<prompt>"` | `opencode run --model <model> --prompt-file /dev/stdin` |
| codex | `codex --model <model> "<prompt>"` | `codex exec --model <model> --prompt-file /dev/stdin` |

All adapters implement `CliAdapter` via `BaseCliAdapter` (`src/adapters/cli/base.ts`).

### Lockfiles

Per-task lockfile at `~/.bode/runs/<KEY>/lock.json` (v0.19.0). Prevents two concurrent invocations of the same task from clobbering each other. `bode abort` clears the lock.

## Skill Prompts

Each skill file is markdown with this shape:

```markdown
# Skill: Planning

## Role
You are a senior engineer planning the implementation of a task.

## Context (injected by bode)
<task description>
<project AGENTS.md / CLAUDE.md if present>
<repo file tree>
<prior artifacts>

## Instructions
- Output a plan as markdown with sections: Goal, Approach, Files to modify, Risks, Tests needed
- Do not write code in this phase
- If ambiguous, list questions instead of guessing

## Output format
Pure markdown.
```

Neutral source format: bundled skills are authored as `src/skills/defaults/<name>.neutral.md`. `scripts/build-skills.mjs` emits `<name>.claude.md`, `<name>.openai.md`, and the neutral fallback before esbuild runs.

Resolution: `<repo>/.bode/skills/<name>.md` → `~/.bode/skills/<name>.md` → flavored bundled default (`claude-code` → `.claude.md`, `codex` / `opencode` → `.openai.md`) → neutral bundled default.

Every strict artifact starts with a YAML contract containing `objective`, `depends_on`, `files`, `validation`, `expected_output`, and `risk`.

Community skills can be installed with `bode skills install <repo>#<path>`. Installs are pinned by source metadata under `~/.bode/skills/<slug>/.install.json`; bode never auto-updates them.

## Wave 8 Local Power Surfaces

### Parallel Scheduler

`~/.bode/scheduler.json` stores local task state for `bode list --watch`, `bode cancel`, external monitors, and future worktree-based parallel execution. Entries include task key, repo, phase, status, pid, CLI, model, and timestamps. Running entries with dead PIDs are marked `crashed` on read.

### Budgets

Config supports:

```yaml
budget:
  per_task_max_usd: 5
  per_phase_max_usd: 2
  daily_max_usd: 25
  abort_on_breach: true
  warn_at_pct: 80
  fallback_if_no_usage_data: continue
```

Usage aggregates live under `~/.bode/usage/<YYYY-MM-DD>.json`. Enforcement is best-effort because AI CLIs expose usage differently.

### Memory

`bode memory init` opts the current project into prompt memory. Files live under `~/.bode/memory/<project-slug>/` and are injected below `.bode/context.md` and above `AGENTS.md` when `memory.enabled` is set.

### Trigger Architecture

`/bode plan`, `/bode fix`, and `/bode review` are parsed by the local trigger parser and by the webhook skeleton under `packaging/webhook/`. The webhook verifies GitHub HMAC signatures and never sees AI provider keys; execution belongs to the user's runner.

### Multi-repo

`repos[]` accepts `name`, `workdir`, `role`, and `optional`. The multi-repo runner primitive builds a per-repo plan used by future fan-out phase execution.

Skills are user-editable; never refactor them automatically.

## Hooks

Defined in `src/orchestrator/hooks.ts`. Configured in YAML at global or project scope:

```yaml
hooks:
  pre_planning: [...]
  post_planning: [...]
  pre_implementation: [...]
  post_implementation: [...]
  pre_review: [...]
  post_review: [...]
  pre_pr: [...]
  post_pr: [...]
```

Each entry is either a string (the command) or `{ run: string, non_blocking?: boolean }`. Default `non_blocking: false` — non-zero exit aborts the phase.

Env vars passed to each hook:

- `BODE_TASK_KEY`
- `BODE_PHASE` (`planning` / `implementation` / `review` / `pr`)
- `BODE_HOOK` (`pre_implementation` / etc.)
- `BODE_WORKDIR` (absolute path)

## Tracker Integration

### Selection

See [Strategy Architecture](#strategy-architecture) → IssueTrackerStrategy.

### Status mapping per tracker

| Tracker | "In Progress" | "Code Review" | "Done" |
|---|---|---|---|
| Jira | Jira transition (configurable via `setup-transitions`) | Jira transition | Jira transition |
| GitHub Issues | Open + `bode:implementing` label | Open + `bode:reviewing` label | Closed |
| Linear | Linear workflow state (by name) | Linear workflow state | Linear workflow state |
| Notion | Status property value | Status property value | Status property value |
| Trello | Card moves between lists named like the status | Card moves between lists | Card moves between lists |
| Local | YAML frontmatter `status:` | YAML frontmatter `status:` | YAML frontmatter `status:` |

### Summary comments

A summary comment is posted to the tracker on every phase boundary (planning, implementation, review, PR creation, conflicts, done). Comments are truncated at `comment_format.plan_inline_max_chars` (default 3000) to fit tracker field size limits.

### Setup

`bode setup` runs interactive credential collection per tracker; tests the connection; offers retry on failure. All tracker ops go through `src/adapters/jira/` (Jira) or `src/adapters/tracker/` (everything else). Never call any tracker API directly outside those adapters.

## VCS Integration

### Providers

| Provider | CLI | Adapter |
|---|---|---|
| GitHub | `gh` | `src/adapters/vcs/github.ts` |
| GitLab | `glab` | `src/adapters/vcs/gitlab.ts` |

Factory: `src/adapters/vcs/factory.ts`. Resolution: project `vcs_provider` > global `vcs.provider` > default `github`.

### Branch naming by issue type

| Tracker issue type | Branch prefix | Example |
|---|---|---|
| Story | `feat/` | `feat/kd-312` |
| Bug | `fix/` | `fix/kd-100` |
| Task | `chore/` | `chore/kd-200` |
| Improvement | `refactor/` | `refactor/kd-300` |
| Sub-task | `feat/` | `feat/kd-500` |
| Unknown | `feat/` | `feat/kd-400` |

For local tasks (no tracker), the key is auto-generated as `local-<short-hash>` and the prefix defaults to `feat/`.

### Lifecycle

```
bode start KD-312
  → AI session creates branch via its own tool calls and writes the name to ~/.bode/runs/<KEY>/branch.txt
  → bode reads it; tracker setStatus

bode continue KD-312 (PR phase)
  → AI checks for conflicts with base branch
  → AI runs gh pr create / glab mr create and writes PR URL to ~/.bode/runs/<KEY>/pr.txt

bode done KD-312
  → optionally merges PR (gh pr merge / glab mr merge)
  → git checkout <base>
```

### Conflict detection

Before PR creation, bode fetches latest from origin and checks if base is an ancestor of the task branch. On conflict: marks `conflict: true` in meta, adds `bode:conflict` label/tag, warns developer.

### Custom base branch

```bash
bode start KD-312 --from-branch develop
```

## Multi-Developer Coordination

bode is local-only and stateless across developers. Coordination relies on the tracker:

- **Assignee field:** dev who runs `bode start` becomes assignee.
- **Labels/tags:** show current phase, visible to whole team.
- **Comments:** narrate progress.

If two devs run `bode start` on the same task simultaneously, second one detects existing `bode:*` label/tag and refuses with `"Task already in phase X by @assignee. Run with --force if you really want to take over."`

## Failure Modes

| Failure | Behavior |
|---|---|
| Tracker unreachable | Exit with clear error. No state changes. |
| AI CLI not installed | Exit with install instructions for that CLI (`errorChecklist`). |
| AI CLI exits non-zero | Phase marked failed regardless of artifact (v0.20.0 exit-code gate). Comment failure on tracker with last 50 lines of log. Reset label. |
| Phase timeout | Abort CLI process. Comment on tracker. User can `bode continue` to retry. |
| Network drop mid-phase | Local log preserved. User can `bode continue` to retry or `bode abort` to cancel. |
| Conflicting labels | Exit with diagnostic. User runs `bode abort` to reset. |
| Branch conflict with base | Stop before PR creation. Warn user to resolve manually. |
| Workdir / context_paths / repos[] unreadable | Preflight aborts the phase with structured error listing every offender (v0.12.0). |
| AI session exits without writing the artifact | Bode shows a yellow warning and asks `[retry \| continue \| abort]` (v0.13.0). |
| Hook command exits non-zero | Phase aborts unless hook has `non_blocking: true`. |
| Two concurrent runs on same task | Second invocation refuses on the lockfile (v0.19.0). |

## Telemetry

Opt-in, off by default. Commands:

```bash
bode telemetry on        # enable
bode telemetry off       # disable (preserves machineId)
bode telemetry status    # show state
bode telemetry preview   # last 10 events (local only)
```

### What gets recorded

Per event (`src/utils/telemetry.ts`):

- `event` (string) — command name + outcome
- `timestamp` (ISO-8601)
- `success` (boolean)
- `duration_ms` (number)
- `tracker_kind` (`jira` / `github-issues` / `linear` / `notion` / `trello` / `local`)
- `cli_adapter` (`claude-code` / `opencode` / `codex`)
- `bode_version`, `node_version`, `platform`
- `machine_id` (anonymous UUID, generated locally)

### What never gets recorded

- Task content, summaries, descriptions
- Ticket IDs, branch names, PR URLs
- Code, file paths
- Credentials, tokens, API keys

### Storage and transport

- Local NDJSON at `~/.bode/telemetry/events.ndjson`
- No network unless `telemetry.endpoint` is configured (defaults to none)

## Definition of Done (current)

### Engine (Waves 0–5 closed)

- [x] `bode setup` configures tracker, CLIs per phase, VCS provider
- [x] `bode start <KEY>` creates branch, runs planning phase end-to-end
- [x] Plan posted as tracker comment (inline or truncated)
- [x] Tracker status and labels/tags update correctly
- [x] `bode continue <KEY>` advances through phases
- [x] PR created via `gh` for GitHub, `glab` for GitLab (by the AI itself since v0.16.0)
- [x] `bode done <KEY>` cleans up state, switches branch, optionally merges PR
- [x] `bode abort <KEY>` cancels execution, cleans up branch
- [x] `--auto` runs all phases sequentially
- [x] `--dangerously-auto-merge` runs all phases + merges PR
- [x] `--dangerously-approve-all` injects each CLI's bypass flag
- [x] Multi-project config system with per-project overrides
- [x] Context gathering (AGENTS.md + file tree) injected into prompts
- [x] Tracker transitions per column, configurable via `bode setup-transitions`
- [x] Summary comments posted to tracker for every phase
- [x] VCS adapters for GitHub (gh) and GitLab (glab)
- [x] Branch naming by issue type
- [x] Conflict detection before PR creation
- [x] `--from-branch` flag for custom base branch
- [x] 3 CLI adapters: Claude Code, OpenCode, Codex
- [x] 7 tracker implementations: Jira (real + mock), GitHub Issues, Linear, Notion, Trello, Local/plain-markdown
- [x] Interactive AI sessions with `stdio: 'inherit'` (v0.13.0+)
- [x] Preflight checks for workdir / context_paths / repos[]
- [x] Missing-artifact interactive prompt `[retry | continue | abort]`
- [x] Atomic meta.json writes (temp + rename)
- [x] Lockfiles per task key
- [x] Exit-code gate (non-zero AI exit → phase fails)
- [x] Prompt-injection guard (untrusted content wrapped + defensive skill instructions)
- [x] `bode <prompt>` fast path
- [x] `bode` (no args) resumes latest
- [x] `bode new <summary>` creates local task without invoking AI
- [x] `bode doctor` diagnoses env
- [x] `bode telemetry [on|off|status|preview]` opt-in instrumentation
- [x] `bode compare <KEY> --agents <list>` planning-phase comparison
- [x] `bode setup-transitions` interactive workflow mapping
- [x] Plugin hooks (`pre_<phase>` / `post_<phase>`)
- [x] Structured errors (`errorWithHint`, `errorChecklist`, `missingConfigError`, `unknownAdapterError`)
- [x] SEA single-file binary toolchain (`scripts/build-sea.mjs`)
- [x] Homebrew formula + scoop manifest templates
- [x] Release-SEA GitHub Actions workflow

### Open (gated on external action)

- [ ] Publish `bode` to npm registry (#21)
- [ ] Homebrew tap + scoop bucket auto-bump on release tags (#19 finish-up)
- [ ] Demo video (#23)
- [ ] Launch post (#24)
- [ ] Skill marketplace (#25 — gated to Wave 9)
- [ ] GitHub App for issue-triggered runs (#28 — gated to Wave 9)
- [ ] Integration tests for VCS adapters (gh/glab)

See `ROADMAP.md` for the full Waves 6–9 plan.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Tracker API changes (Jira / Linear / Notion / Trello / Github Issues) | Per-adapter integration tests with recorded fixtures; pinned API versions where supported (Notion: `2022-06-28`) |
| Native CLI changes headless interface | `CliAdapter` abstraction; per-CLI smoke tests |
| Plans of poor quality due to weak skill prompts | Skills versioned in repo, iterate based on real usage; users can override per project |
| Two devs working same task | Label/tag detection + assignee check + lockfile + explicit `--force` |
| Plans grow too large for tracker comments | Auto-truncation at `plan_inline_max_chars` (default 3000) |
| Token cost from AI CLIs | Each phase has timeout; failures don't auto-retry; logs preserve full output for manual audit; cost tracking is Wave 8 |
| Prompt injection from tracker content | Wrapped in `<untrusted>` markers; bundled skills include defensive instructions |
| AI CLI exits without artifact | Interactive `[retry \| continue \| abort]` prompt; exit-code gate marks phase failed on non-zero |
| Concurrent runs clobber state | Atomic meta writes + per-task lockfiles |
| npm install from GitHub fails on Windows | Tarball install workaround documented; SEA binary alternative |
| Tracker credentials in plaintext config | Documented preference for env vars (`LINEAR_API_KEY`, `NOTION_TOKEN`, `TRELLO_KEY`/`TRELLO_TOKEN`) over storing in YAML |

## Out of Scope (still)

Validated product directions for a different product, intentionally not pursued:

- Workflow DSL with declarative phases + gates + validations
- Policy engine
- RBAC / SSO / audit export
- Hosted dashboard / cloud SaaS (Wave 9 only if signal exists)
- "Agent HQ" multi-agent enterprise orchestration

bode's bet: solo and small-team adoption beats top-down enterprise rollout. If a real customer (paid, signed) asks for any of the above, that's signal — revisit then.
