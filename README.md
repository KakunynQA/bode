<div align="center">

# 🐐 Bode

<p>
  <a href="https://github.com/KakunynQA/bode">
    <img alt="Version" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FKakunynQA%2Fbode%2Fmain%2Fpackage.json&query=%24.version&label=Version&style=for-the-badge">
  </a>
  <a href="https://nodejs.org">
    <img alt="Node 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js">
  </a>
  <a href="https://github.com/KakunynQA/bode/blob/main/package.json">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript">
  </a>
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge">
</p>

<p>
  <strong>AI Coding Orchestrator for Jira</strong><br>
  Current version: <strong>0.10.1</strong><br>
  Drives <strong>Claude Code</strong>, <strong>OpenCode</strong>, and <strong>Codex</strong> through configurable phases, syncs progress to <strong>Jira</strong>, and manages PRs on <strong>GitHub</strong> and <strong>GitLab</strong>.
</p>

<p>
  <a href="https://github.com/KakunynQA/bode">Repository</a>
  ·
  <a href="https://github.com/KakunynQA/bode/issues">Issues</a>
  ·
  <a href="#commands">Commands</a>
  ·
  <a href="#configuration">Configuration</a>
  ·
  <a href="#branch-strategy">Branch Strategy</a>
</p>

</div>

---

## Why Bode

**Bode** is a local CLI that orchestrates AI coding work through configurable phases (planning, implementation, review), driving native AI CLIs and syncing progress to Jira so the team has shared visibility without leaving their existing workflow.

It is a strong fit for:

- teams using **Jira** for task tracking
- developers using **Claude Code**, **OpenCode**, or **Codex** for AI-assisted coding (Z.AI's GLM models work through any of these via `npx @z_ai/coding-helper init`)
- projects that need **auditability** of AI-generated plans and reviews
- teams that want **shared visibility** of AI progress via Jira labels and comments
- teams following **GitHub Flow** for branching (GitHub and GitLab supported)

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Branch Strategy](#branch-strategy)
- [Auto Mode](#auto-mode)
- [Commands](#commands)
- [Configuration](#configuration)
- [Skills](#skills)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Installation

### Install globally from GitHub

```bash
npm i -g KakunynQA/bode
```

### Install from source (recommended on Windows)

```bash
git clone https://github.com/KakunynQA/bode.git
cd bode
npm install
npm run build
npm pack
npm i -g bode-*.tgz
```

After installation, the `bode` command is available globally:

```bash
bode --version
bode --help
```

### Requirements

- **Node.js** >= 18
- **Git** installed and configured
- **gh CLI** (GitHub PRs) or **glab CLI** (GitLab MRs)
- At least one AI CLI installed: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenCode](https://opencode.ai), or [Codex](https://github.com/openai/codex). To route any of these through Z.AI's GLM models, run [`npx @z_ai/coding-helper init`](https://docs.z.ai/devpack/extension/coding-tool-helper).
- Jira account with an [API token](https://id.atlassian.com/manage-profile/security/api-tokens)

---

## Quick start

### 1. Run setup

```bash
bode setup
```

Interactive wizard that asks for your Jira site, project key, GitHub org, and which AI CLI to use for each phase. Saves to `~/.bode/config.yml`.

### 2. Configure a project

```bash
bode setup-project
```

Creates a project config in `~/.bode/projects/<name>.yml` with workdir, default branch, context paths, per-project Jira overrides, and **per-phase CLI/model overrides**. Only saves values that differ from the global config.

### 3. Start a task

```bash
bode start KD-312 --project grid
```

Creates a Git branch (`feat/kd-312` based on Jira issue type), pushes it, fetches the Jira ticket, runs the **planning** phase, and adds the label `bode:planned`.

### 4. Review plan and continue

Review the plan in Jira. When ready:

```bash
bode continue KD-312   # runs implementation phase
bode continue KD-312   # runs review phase
```

### 5. PR and merge

```bash
bode continue KD-312   # creates PR, moves to "awaiting-merge"
# Review the PR manually on GitHub...
bode done KD-312 --yes # switches back to base branch, marks done
```

---

## Branch Strategy

Bode follows **GitHub Flow** integrated into the task lifecycle:

### Branch naming by Jira issue type

| Jira Issue Type | Branch Prefix | Example |
| --- | --- | --- |
| Story | `feat/` | `feat/kd-312` |
| Bug | `fix/` | `fix/kd-100` |
| Task | `chore/` | `chore/kd-200` |
| Improvement | `refactor/` | `refactor/kd-300` |
| Sub-task | `feat/` | `feat/kd-500` |
| Unknown | `feat/` | `feat/kd-400` |

### Task lifecycle with branches

```
bode start KD-312
  → git checkout -b feat/kd-312 main
  → git push -u origin feat/kd-312
  → runs planning phase

bode continue KD-312
  → runs implementation phase

bode continue KD-312
  → runs review phase

bode continue KD-312
  → checks for conflicts with base branch
  → creates PR via gh/glab CLI
  → status: awaiting-merge (waiting for manual review)

# Developer reviews PR on GitHub...

bode done KD-312 --yes
  → switches back to base branch
  → marks Jira as Done
```

### Conflict handling

When advancing to `awaiting-merge`, Bode checks for conflicts with the base branch:

1. Fetches latest from origin
2. Checks if base branch is ancestor of task branch
3. If conflicts detected:
   - Marks the task with `conflict: true`
   - Adds `bode:conflict` label in Jira
   - Stops and warns the developer
   - Developer must resolve conflicts manually

### Multi-branch support

Multiple tasks can run in parallel on different branches. Each task has its own branch tracked in the run metadata.

### Custom base branch

```bash
bode start KD-312 --from-branch develop
```

Uses `develop` instead of the project's default branch.

### Auto-merge (use with caution)

```bash
bode done KD-312 --yes --auto-approve-pr-merge
```

Automatically merges the PR and deletes the branch. **Warning:** auto-merge can cause problems. The default behavior is to leave the PR open for manual review.

### Abort and cleanup

```bash
bode abort KD-312 --yes
```

Switches back to the base branch, deletes the task branch, and marks the task as aborted.

---

## Auto Mode

Bode can run all phases automatically without manual gates between them:

### `--auto`

```bash
bode start KD-312 --auto
# runs: planning → implementation → review → PR creation in one command
```

Each phase runs sequentially. Stops after creating the PR (`awaiting-merge` status) so you can review it manually.

### `--auto-and-merge-dangerously`

```bash
bode start KD-312 --auto-and-merge-dangerously
```

Runs all phases AND merges the PR automatically. Shows a warning about the risks before proceeding. Use only in well-tested, low-risk workflows.

---

## Commands

| Command | Description |
| --- | --- |
| `bode setup` | Interactive setup wizard. Configures Jira, CLIs, VCS provider. |
| `bode setup-project` | Create or edit a project config (workdir, context, Jira, VCS overrides). |
| `bode start <KEY>` | Start a task. Creates branch, runs planning phase. |
| `bode continue <KEY>` | Advance to next phase. Creates PR at awaiting-merge. |
| `bode status <KEY>` | Show current phase, branch, PR link, conflict status. |
| `bode show <artifact> <KEY>` | Print artifact to stdout. Artifacts: `plan`, `implementation`, `review`. |
| `bode log <KEY>` | Show the log of the current or last phase. |
| `bode abort <KEY>` | Cancel execution, clean up branch, reset labels. |
| `bode done <KEY>` | Mark task as done. Switches to base branch. Optionally merges PR. |
| `bode list` | List all tasks tracked locally (branch, conflict status shown). |
| `bode skills` | Show resolved skill paths and prompts. |

All commands support `--help` for detailed usage.

Key flags:

| Flag | Command(s) | Description |
| --- | --- | --- |
| `--project <name>` | start, continue | Project name from `~/.bode/projects/` |
| `--from-branch <branch>` | start | Base branch (default: project's `default_branch` or `main`) |
| `--auto` | start | Run all phases sequentially until PR created |
| `--auto-and-merge-dangerously` | start | Run all phases + merge PR + mark done (with warning) |
| `--auto-approve-pr-merge` | done | Automatically merge PR before cleanup |
| `-y, --yes` | abort, done | Skip confirmation prompt |

---

## Configuration

### Resolution order

1. **Project config:** `~/.bode/projects/<name>.yml` (per-project overrides)
2. **Local config:** `<project>/.bode.yml` (legacy, overrides)
3. **Global config:** `~/.bode/config.yml` (main)
4. **Defaults:** built into Bode

### `~/.bode/config.yml`

```yaml
jira:
  site: mycompany.atlassian.net
  default_project: KD
  email: you@company.com          # for API token auth
  api_token: your-api-token-here

vcs:
  provider: github  # "github" or "gitlab"

github:
  default_org: myorg

phases:
  planning:
    cli: claude-code
    model: claude-opus-4-7
    timeout_minutes: 15

  implementation:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 60

  review:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 10

gates:
  after_planning: true
  after_implementation: true

defaults:
  project: grid
```

### `~/.bode/projects/grid.yml`

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
```

### Local storage

```
~/.bode/
├── config.yml              # global config
├── projects/               # per-project configs
│   ├── grid.yml
│   └── api.yml
├── runs/
│   └── KD-312/
│       ├── meta.json       # task metadata, branch, PR, phase
│       ├── planning.log    # raw output from planning CLI
│       ├── planning.md     # extracted plan
│       ├── implementation.log
│       ├── implementation.md
│       ├── review.log
│       └── review.md
└── skills/                 # custom skill prompts
    ├── planning.md
    ├── implementation.md
    └── review.md
```

---

## Skills

Skills are markdown prompts that drive each phase. They are intentionally simple files so they can be edited without touching code.

### Resolution order

1. Project skill: `<project>/.bode/skills/<phase>.md`
2. Global skill: `~/.bode/skills/<phase>.md`
3. Bundled default (shipped with Bode)

First match wins. Copy a bundled skill to `~/.bode/skills/` and edit it to customize behavior.

### Bundled skills

| Skill | Phase | Purpose |
| --- | --- | --- |
| `planning.md` | Planning | Produces an actionable plan from the Jira ticket |
| `implementation.md` | Implementation | Executes the plan, runs validation, commits |
| `review.md` | Review | Critical code review with verdict (APPROVE / REQUEST_CHANGES) |

---

## Development

```bash
# Install dependencies
npm install

# Run CLI from source (no build needed)
npm run dev -- setup
npm run dev -- start KD-312

# Validation
npm run check          # TypeScript typecheck
npm run lint           # ESLint
npm run format:check   # Prettier check
npm run build          # Compile to dist/
npm test               # Run unit tests

# Build and install globally from source
npm run build
npm pack
npm i -g bode-*.tgz
```

---

## Troubleshooting

### Existing run detected

If a task already has a run, Bode asks:
- **Abort and restart** — aborts the previous run and starts fresh
- **Continue** — skips branch setup and continues from the current phase
- **Cancel** — exits

### `bode` command not found

Make sure you installed globally:

```bash
npm i -g KakunynQA/bode
```

Or from source:

```bash
cd bode && npm run build && npm pack && npm i -g bode-*.tgz
```

### Windows npm install from GitHub fails

This is a known issue with npm 11 on Windows (symlink bug). Use the tarball install method instead:

```bash
git clone https://github.com/KakunynQA/bode.git
cd bode
npm install
npm run build
npm pack
npm i -g bode-*.tgz
```

### Jira connection fails

Bode connects to Jira via REST API v3 using Basic Auth with an API token.

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Give it a name (e.g. "bode")
4. Copy the token
5. Run `bode setup` and enter your Jira email and the token when prompted

The token is stored in `~/.bode/config.yml`. Keep this file secure.

### CLI not installed

Each phase requires an AI CLI. Install at least one:

- Claude Code: `npm i -g @anthropic-ai/claude-code`
- OpenCode: follow instructions at [opencode.ai](https://opencode.ai)
- Codex: `npm i -g @openai/codex`
- Z.AI (GLM models via claude-code/opencode/codex): `npx @z_ai/coding-helper init`

### "Permission denied" / "I need read access to ..."

Since v0.13.0 the AI CLI runs **interactively in your terminal** by default — you see the live session and approve tool calls in the CLI's own native UI, just like running `claude` or `codex` directly.

Two safety nets remain:

- **Preflight:** before each phase, bode checks that `workdir`, every `context_paths[]`, and every `repos[].workdir` is readable. If not, the phase aborts before spending tokens, listing every unreachable path.
- **`--dangerously-approve-all`:** pass on `bode start` / `bode continue` to inject each CLI's bypass-approvals flag (claude: `--dangerously-skip-permissions`, codex: `--dangerously-bypass-approvals-and-sandbox`). For CLIs without an equivalent flag (opencode) bode warns upfront and asks whether to proceed — you'll approve actions interactively.

### AI session exited without writing the artifact

When the AI exits without producing the phase artifact at `~/.bode/runs/<KEY>/<phase>.md`, bode shows a yellow warning and asks `[retry | continue | abort]`. Inspect what happened with `bode log <KEY>`.

### Branch creation fails / dirty workdir

Bode now prompts you when the working directory has uncommitted changes:
- **Stash** — auto-stashes with `git stash push -m "bode:auto-stash:<TASK>"` and continues
- **Retry** — exits so you can handle it manually, then re-run
- **Abort** — cancels the command

### `gh` / `glab` CLI not found

PR creation requires the [GitHub CLI](https://cli.github.com/) (`gh`) or the [GitLab CLI](https://gitlab.com/gitlab-org/cli) (`glab`), depending on your VCS provider config. Install the appropriate one and authenticate.

- GitHub: `gh auth login`
- GitLab: `glab auth login`

### Phase timeout

Each phase has a configurable timeout (default: 15 min for planning, 60 min for implementation, 10 min for review). Increase in `~/.bode/config.yml` if needed.

---

## License

[MIT](./LICENSE) — Kakunyn
