# Bode — Technical Specification (v0.10.1)

## What Bode Is

Bode is a local CLI that orchestrates AI coding work through configurable phases (planning, implementation, review), driving native AI CLIs (Claude Code, OpenCode, Codex, Z.AI) and syncing progress to Jira so the team has shared visibility without leaving their existing workflow.

## What Bode Is Not

- Not a dashboard. Jira is the source of truth for visibility.
- Not an autonomous agent. Developers pull tasks explicitly.
- Not a CLI wrapper. Each phase runs its own configured AI CLI; Bode is the orchestrator above them.
- Not a 24/7 daemon. Bode runs when a developer invokes it.

## Core Workflow

```
Developer picks up Jira task KD-312 (status: To Do)
  │
  ▼
$ bode start KD-312
  │
  ├─ Validates task exists, fetches details
  ├─ Creates Git branch (feat/kd-312) from base branch
  ├─ Pushes branch to origin
  ├─ Moves Jira status → "In Progress"
  ├─ Posts comment: "🤖 Planning started"
  ├─ Runs planning phase (configured CLI + skill + context)
  ├─ Saves plan to ~/.bode/runs/KD-312/planning.md
  ├─ Posts plan summary as Jira comment
  └─ Exits. Developer reviews plan.

Developer reviews plan in Jira, approves implicitly by continuing:
  │
  ▼
$ bode continue KD-312
  │
  ├─ Validates current phase is "planned"
  ├─ Moves Jira status → "In Review"
  ├─ Posts comment: "🤖 Implementation started"
  ├─ Runs implementation phase (configured CLI + skill + plan context)
  ├─ Saves implementation artifact to ~/.bode/runs/KD-312/implementation.md
  ├─ Checks for conflicts with base branch
  ├─ Creates PR via gh/glab CLI
  ├─ Posts PR summary as Jira comment
  └─ Exits. Developer reviews PR.

Developer continues to review phase:
  │
  ▼
$ bode continue KD-312
  │
  ├─ Moves Jira status → "Code Review"
  ├─ Posts comment: "🤖 Review started"
  ├─ Runs review phase (AI self-review against checklist)
  ├─ Posts review as PR comment
  ├─ Posts review summary as Jira comment
  └─ Exits. Human review needed on PR.

Developer reviews PR, merges manually or via bode:
  │
  ▼
$ bode done KD-312
  │
  ├─ Optionally merges PR (if --auto-approve-pr-merge)
  ├─ Switches to base branch
  ├─ Moves Jira status → "Done"
  ├─ Removes all "bode:*" labels
  └─ Posts comment: "🤖 Task complete. Artifacts archived locally."
```

## Autopilot / Auto Mode

### `--auto` flag (v0.8.0)

Runs all phases sequentially without gates:

```bash
bode start KD-312 --auto
# planning → implementation → review → awaiting-merge (PR created) in sequence
```

### `--auto-and-merge-dangerously` (v0.8.0)

Same as `--auto` plus automatically merges the PR and marks as done:

```bash
bode start KD-312 --auto-and-merge-dangerously
```

Shows a prominent warning about the risks before proceeding. Use only for fully automated, well-tested workflows.

## Tech Stack

- **Language:** TypeScript (strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Runtime:** Node.js >=18, built with esbuild to single CJS bundle in `dist/index.js`
- **CLI framework:** `commander`
- **Interactive prompts:** `@inquirer/prompts` (arrow-key selection)
- **Jira integration:** REST API v3 with API Token (Basic Auth via email + token), mock adapter as fallback
- **AI CLI invocation:** `child_process` in headless mode through `CliAdapter` interface
- **VCS:** Git operations via `GitAdapter`, PR/MR via `gh` (GitHub) or `glab` (GitLab) CLI
- **Local storage:** filesystem (`~/.bode/`), no DB
- **Config:** YAML (`~/.bode/config.yml` + `~/.bode/projects/<name>.yml` + `project/.bode.yml`)
- **Skill prompts:** Markdown (`~/.bode/skills/`, project `.bode/skills/`, bundled defaults)
- **Tests:** `node --test` for units, integration tests for adapters
- **Logging:** structured JSON lines to `~/.bode/runs/<KEY>/<phase>.log`, pretty output to terminal
- **Build:** esbuild → `dist/index.js` (CJS), static assets embedded via `define`
- **ASCII art:** `src/assets/bode.art` embedded at build time as `__GOAT_ART__`

## Directory Layout

### User home

```
~/.bode/
├── config.yml              # global config: Jira, CLIs, VCS provider, defaults
├── projects/               # per-project configs
│   ├── grid.yml
│   └── api.yml
├── runs/
│   └── KD-312/
│       ├── meta.json       # task metadata, current phase, branch, PR, timestamps
│       ├── planning.log    # raw output from planning CLI
│       ├── planning.md     # extracted plan
│       ├── implementation.log
│       ├── implementation.md
│       ├── review.log
│       └── review.md
└── skills/                 # custom skill prompts (override bundled)
    ├── planning.md
    ├── implementation.md
    └── review.md
```

### Project (optional override)

```
<project-root>/
├── .bode.yml               # project-specific config overrides (legacy)
└── .bode/
    └── skills/             # project-specific skills (override global)
        ├── planning.md
        ├── implementation.md
        └── review.md
```

## Configuration Schema

### Resolution order

1. **Project config:** `~/.bode/projects/<name>.yml` (per-project overrides)
2. **Local config:** `<project>/.bode.yml` (legacy, overrides)
3. **Global config:** `~/.bode/config.yml` (main)
4. **Defaults:** built into Bode

### `~/.bode/config.yml`

```yaml
jira:
  site: kakunyn.atlassian.net
  default_project: KD
  email: you@company.com
  api_token: your-api-token

vcs:
  provider: github  # "github" or "gitlab"

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
  project: grid          # default project for --project flag

jira_labels:
  planning: bode:planning
  planned: bode:planned
  implementing: bode:implementing
  reviewing: bode:reviewing
  reviewed: bode:reviewed
  autopilot: bode:autopilot

comment_format:
  plan_inline_max_chars: 3000
  use_emoji: true
```

### `~/.bode/projects/<name>.yml` (v0.6.0+)

```yaml
name: grid
workdir: /home/user/projects/grid-stack
default_branch: main

jira:
  site: mycompany.atlassian.net
  default_project: GRID

vcs_provider: github  # override per project

context_paths:
  - .
  - ../grid-ui/src

context_files:
  - AGENTS.md
  - CLAUDE.md

phases:
  implementation:
    model: claude-opus-4-7  # this project needs Opus for implementation
```

### `<project>/.bode.yml` (legacy overrides)

```yaml
phases:
  implementation:
    model: claude-opus-4-7
```

## CLI Commands (v0.8.0)

| Command | What it does |
|---|---|
| `bode setup` | Interactive setup. Configures Jira OAuth, default CLI per phase, VCS provider, GitHub/GitLab access. |
| `bode setup-project` | Interactive project config wizard (workdir, default_branch, context, Jira, VCS). |
| `bode start <KEY>` | Starts task. Creates branch, runs planning phase. |
| `bode continue <KEY>` | Advances to next phase. Creates PR at awaiting-merge. |
| `bode status <KEY>` | Shows current phase, branch, PR link, conflict status. |
| `bode show <artifact> <KEY>` | Prints artifact to stdout. Artifacts: `plan`, `implementation`, `review`. |
| `bode log <KEY>` | Shows the log of the current or last phase. |
| `bode abort <KEY>` | Cancels execution, cleans up branch, resets Jira labels. |
| `bode done <KEY>` | Marks task as done. Switches to base branch. Optionally merges PR. |
| `bode list` | Lists all tasks currently tracked locally (branch, conflict status). |
| `bode skills` | Shows resolved skill paths and prompts. |

### Flags (v0.8.0)

| Flag | Command(s) | Description |
|---|---|---|
| `--project <name>` | start, continue | Project name from `~/.bode/projects/` |
| `--from-branch <branch>` | start | Base branch (default: project's `default_branch` or `main`) |
| `--auto` | start | Run all phases sequentially until PR created |
| `--auto-and-merge-dangerously` | start | Run all phases + merge PR + mark done |
| `--auto-approve-pr-merge` | done | Automatically merge PR before cleanup |
| `-y, --yes` | abort, done | Skip confirmation prompt |

## Phase Execution Detail

Each phase follows the same pattern:

1. Load skill prompt from configured path (project override > global default > bundled).
2. Build context: Jira ticket description, all prior phase artifacts, project rules (`AGENTS.md`/`CLAUDE.md` if present in repo), file tree.
3. Invoke configured CLI in headless mode with context as input.
4. Capture stdout/stderr to `runs/<KEY>/<phase>.log`.
5. Extract the artifact (plan/implementation summary/review) and save to `runs/<KEY>/<phase>.md`.
6. Post artifact to Jira as a summary comment (inline or truncated at `plan_inline_max_chars`).
7. Transition Jira status to the appropriate column.
8. Exit with status code 0 on success, non-zero on failure.

### Context Gathering (v0.6.0+)

When a project config specifies `context_files` (e.g., `AGENTS.md`, `CLAUDE.md`) and `context_paths`, Bode:

1. Reads the content of each context file (resolved relative to `workdir`).
2. Generates a file tree for each context path (excluding `node_modules/`, `.git/`, `dist/`).
3. Injects the combined context into the AI CLI prompt before the skill instructions.

This gives the AI CLI awareness of project conventions, architecture, and file layout.

## CLI Headless Invocation

| CLI | Invocation pattern |
|---|---|
| claude-code | `claude --print --model <model> < prompt.txt > output.log` |
| opencode | `opencode run --model <model> --prompt-file /dev/stdin` |
| codex | `codex exec --model <model> --prompt-file /dev/stdin` |
| zai | `zai-coding --model <model> --prompt-file /dev/stdin` |

All adapters implement the `CliAdapter` interface via `BaseCliAdapter`, handling spawn, stdin/stdout/stderr capture, timeout, and exit code interpretation.

Available models per CLI are registered in `src/adapters/cli/models.ts`. The adapter registry is in `src/adapters/cli/registry.ts`.

## Skill Prompt Structure

Each skill file is markdown with three sections:

```markdown
# Skill: Planning

## Role
You are a senior engineer planning the implementation of a Jira task.

## Context (injected by Bode)
<jira ticket>
<project AGENTS.md + CLAUDE.md if exists>
<repo file tree>

## Instructions
- Output a plan as markdown with sections: Goal, Approach, Files to modify, Risks, Tests needed
- Do not write code in this phase
- If the task is ambiguous, list questions instead of guessing

## Output format
Pure markdown. No code fences around the plan itself.
```

Bode injects context between `<context>` markers automatically. Resolution order: project `.bode/skills/<name>.md` > global `~/.bode/skills/<name>.md` > bundled defaults.

## Jira Integration

Bode talks to Jira via the **REST API v3** using Basic Auth with an **API Token**.

### Authentication

1. User creates an API token at https://id.atlassian.com/manage-profile/security/api-tokens
2. During `bode setup`, enters email + token (masked input)
3. Token is stored in `~/.bode/config.yml` under `jira.email` and `jira.api_token`
4. All requests use `Authorization: Basic <base64(email:token)>`

If no email/token is configured, Bode falls back to the `MockJiraAdapter` for testing.

### Jira transitions per phase (v0.9.0)

| Phase Action | Jira Column |
|---|---|
| `bode start` (planning begins) | In Progress |
| `bode continue` (implementation begins) | In Review |
| `bode continue` (review begins) | Code Review |
| `bode done` | Done |

### Summary comments (v0.9.0)

A summary comment is posted to the Jira card for every phase: planning, implementation, review, PR creation, and conflicts. Comments are truncated at `plan_inline_max_chars` (default 3000 chars) to avoid exceeding Jira's field size limits.

### Setup

1. `bode setup` interactive wizard configures Jira site, project key, email, and API token.
2. The connection is tested automatically. On failure, user can retry or skip.
3. All Jira ops go through `src/adapters/jira/`. Never call Jira REST directly outside the adapter.

## VCS Integration (v0.7.0+)

### Providers

Bode supports two VCS providers, configured via `vcs.provider`:

| Provider | CLI | Adapter |
|---|---|---|
| GitHub | `gh` | `src/adapters/vcs/github.ts` |
| GitLab | `glab` | `src/adapters/vcs/gitlab.ts` |

The VCS adapter factory in `src/adapters/vcs/factory.ts` resolves the provider from config (project-level `vcs_provider` > global `vcs.provider` > default `github`).

### Branch Management (v0.7.0+)

Bode follows **GitHub Flow** integrated into the task lifecycle via `src/orchestrator/branch-manager.ts`.

#### Branch naming by Jira issue type

| Jira Issue Type | Branch Prefix | Example |
|---|---|---|
| Story | `feat/` | `feat/kd-312` |
| Bug | `fix/` | `fix/kd-100` |
| Task | `chore/` | `chore/kd-200` |
| Improvement | `refactor/` | `refactor/kd-300` |
| Sub-task | `feat/` | `feat/kd-500` |
| Unknown | `feat/` | `feat/kd-400` |

#### Lifecycle

```
bode start KD-312
  → git checkout -b feat/kd-312 <base>
  → git push -u origin feat/kd-312

bode continue KD-312 (awaiting-merge)
  → checks for conflicts with base branch
  → gh pr create / glab mr create
  → status: awaiting-merge

bode done KD-312
  → optionally merges PR (gh pr merge / glab mr merge)
  → git checkout <base>
```

#### Conflict detection

When advancing to `awaiting-merge`, Bode:
1. Fetches latest from origin
2. Checks if base branch is ancestor of task branch
3. If conflicts: marks `conflict: true`, adds `bode:conflict` label in Jira, warns developer

#### Custom base branch

```bash
bode start KD-312 --from-branch develop
```

## Multi-Developer Coordination

Bode is local-only and stateless across developers. Coordination relies on Jira:

- **Assignee field:** dev who runs `bode start` becomes assignee.
- **Labels:** show current phase, visible to whole team.
- **Comments:** narrate progress.

If two devs run `bode start` on the same task simultaneously, second one detects existing `bode:*` label and refuses with: "Task already in phase X by @assignee. Run with --force if you really want to take over."

## Failure Modes

| Failure | Behavior |
|---|---|
| Jira MCP unreachable | Exit with clear error. No state changes. |
| CLI not installed | Exit with install instructions for that CLI. |
| CLI exits non-zero | Comment failure on Jira with last 50 lines of log. Reset label. |
| Phase timeout | Abort CLI process. Comment on Jira. User can `bode continue` to retry. |
| Network drop mid-phase | Local log preserved. User can `bode continue` to retry or `bode abort` to cancel. |
| Conflicting labels | Exit with diagnostic. User runs `bode abort` to reset. |
| Branch conflict with base | Stop before PR creation. Warn user to resolve manually. |

## Definition of Done (v0.10.1)

- [x] `bode setup` configures Jira, CLIs per phase, VCS provider
- [x] `bode start <KEY>` creates branch, runs planning phase end-to-end
- [x] Plan posted as Jira comment (inline or truncated)
- [x] Jira status and labels update correctly
- [x] `bode continue <KEY>` advances through phases (implementation, review)
- [x] Implementation phase creates branch, PR on GitHub
- [x] PR created via `gh` for GitHub, `glab` for GitLab
- [x] `bode continue <KEY>` runs review phase, posts to PR and Jira
- [x] `bode done <KEY>` cleans up state, switches branch, optionally merges PR
- [x] `bode abort <KEY>` cancels execution, cleans up branch
- [x] `bode setup-project` creates per-project configs
- [x] `--auto` runs all phases sequentially
- [x] `--auto-and-merge-dangerously` runs all phases + merges PR
- [x] Multi-project config system with per-project overrides
- [x] Context gathering (AGENTS.md + file tree) injected into prompts
- [x] Jira transitions per column (In Progress → In Review → Code Review → Done)
- [x] Summary comments posted to Jira for every phase
- [x] VCS adapters for GitHub (gh) and GitLab (glab)
- [x] VCS adapter factory with per-project provider override
- [x] awaiting-merge status separates PR creation from done
- [x] Branch naming by Jira issue type
- [x] Conflict detection before PR creation
- [x] --from-branch flag for custom base branch
- [x] 4 CLI adapters: Claude Code, OpenCode, Codex, Z.AI
- [x] All commands handle network errors gracefully
- [x] Unit test coverage: config loading, CLI adapters, Jira ops, skill resolution, branch naming, VCS resolution
- [x] Real Jira REST adapter with API Token auth
- [x] `bode setup` prompts for email + token, tests connection
- [x] Interactive start prompts for dirty workdir (stash/retry/abort) and existing run (abort/continue/cancel)
- [x] `bode setup project` now asks for per-project phase CLI + model overrides
- [x] `normalizeJiraSite()` helper ensures Jira site URL always has https:// prefix
- [x] `stash()` function for auto-stashing before branch creation
- [x] `abortRun()` reusable helper extracted from abort logic
- [x] `workdir` stored in run meta for correct branch cleanup
- [ ] Integration tests for VCS adapters (gh/glab)

## Out of Scope (post-MVP)

- "Create new project" wizard that decomposes a system description into tasks
- Linear/Notion adapters (Jira-only MVP)
- Dedicated machine mode (24/7 task puller)
- Cost tracking and budgets per task
- Multi-task parallel execution
- Self-improving prompts via feedback loop
- Plugin system for custom phases

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| MCP Atlassian API changes | Pin MCP server version; smoke tests on every release |
| Native CLI changes headless interface | CliAdapter abstraction; per-CLI integration tests |
| Plans of poor quality due to weak skill prompts | Skills are versioned in repo, iterate based on real usage |
| Two devs working same task | Label detection + assignee check + explicit `--force` flag |
| Plans grow too large for Jira comments | Auto-truncation at `plan_inline_max_chars` (default 3000 chars) |
| Token cost from AI CLIs | Each phase has timeout; failures don't auto-retry; cost tracking is post-MVP but logs preserve everything for manual audit |
| npm install from GitHub fails on Windows | Tarball install workaround documented |
