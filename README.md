<div align="center">

# 🐐 Bode

<p>
  <a href="https://github.com/KakunynQA/bode">
    <img alt="Version" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FKakunynQA%2Fbode%2Fmain%2Fpackage.json&query=%24.version&label=Version&style=for-the-badge">
  </a>
  <a href="https://nodejs.org">
    <img alt="Node 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js">
  </a>
  <a href="https://github.com/KakunynQA/bode/blob/main/package.json">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript">
  </a>
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge">
</p>

<p>
  <strong>AI Coding Orchestrator</strong><br>
  Drives <strong>Claude Code</strong>, <strong>OpenCode</strong>, and <strong>Codex</strong> through configurable phases. Syncs progress to <strong>Jira</strong>, <strong>GitHub Issues</strong>, <strong>Linear</strong>, <strong>Notion</strong>, <strong>Trello</strong>, or local markdown. Manages PRs on <strong>GitHub</strong> or <strong>GitLab</strong>.
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
  <a href="ROADMAP.md">Roadmap</a>
</p>

</div>

---

## Why Bode

**Bode** is a local CLI that orchestrates AI coding work through configurable phases (planning, plan-review, implementation, review, PR creation), driving native AI CLIs and syncing progress to whichever issue tracker your team already uses — so AI work has shared visibility without leaving your existing workflow.

It is a strong fit for:

- developers using **Claude Code**, **OpenCode**, or **Codex** for AI-assisted coding (Z.AI's GLM models work through any of these via `npx @z_ai/coding-helper init`)
- teams that want **shared visibility** of AI progress via tracker labels, statuses, and comments
- teams using **Jira**, **Linear**, **GitHub Issues**, **Notion**, **Trello**, or even plain markdown for task tracking
- projects that need **auditability** of AI-generated plans and reviews
- teams following **GitHub Flow** for branching (GitHub and GitLab supported)

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Trackers](#trackers)
- [Commands](#commands)
- [Auto mode](#auto-mode)
- [Hooks](#hooks)
- [Configuration](#configuration)
- [Skills](#skills)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Installation

### Recommended: install from source until we publish to npm (#21)

```bash
git clone https://github.com/KakunynQA/bode.git
cd bode
npm install
npm run build
npm pack
npm i -g bode-*.tgz
```

### Standalone binary (no Node.js required)

On every release tag (`v*`), CI publishes single-file binaries to GitHub Releases:

```text
bode-linux-x64
bode-darwin-x64
bode-darwin-arm64
bode-win32-x64.exe
```

Download the one for your platform from <https://github.com/KakunynQA/bode/releases>, mark it executable, and put it on your `PATH`.

### Homebrew / scoop (manual until #19 lands)

Formula templates ship in `packaging/homebrew/bode.rb` and `packaging/scoop/bode.json`. Once the SHA placeholders are filled in by a release, you can install via your tap of choice.

### Verify

```bash
bode --version
bode doctor
```

`bode doctor` checks your environment (Node, git, AI CLIs, VCS CLIs, tracker auth) and prints what's missing.

### Requirements

- **Node.js** >= 20 (only for the npm install method — SEA binaries embed their runtime)
- **Git** installed and configured
- At least one **AI CLI**: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`npm i -g @anthropic-ai/claude-code`), [OpenCode](https://opencode.ai), or [Codex](https://github.com/openai/codex). To route any of these through Z.AI's GLM models, run [`npx @z_ai/coding-helper init`](https://docs.z.ai/devpack/extension/coding-tool-helper).
- *(Optional)* `gh` CLI for GitHub PRs or `glab` for GitLab MRs
- *(Optional)* An issue tracker — Jira, GitHub Issues, Linear, Notion, or Trello. Without one, bode uses local markdown tasks under `.bode/tasks/`.

---

## Quick start

### First time in a repo

```bash
bode init
bode learn
bode "fix the dashboard bug" --strict
```

`bode init` creates a human-curated `AGENTS.md`. `bode learn` creates an AI-consumable `.bode/context.md` snapshot that is layered into future prompts before the file tree.

### Strict mode

Use `--strict` on `bode start` or the fast path to enable Wave 6 gates: plan-review, YAML artifact contract validation, configured `validation:` commands, configured `release:` checks, and HTML rendering via `bode show plan <KEY> --html`.

### Zero config — just type what you want

In any git repo:

```bash
bode "fix the dashboard ID/name bug"
```

bode auto-detects your installed AI CLI, creates a local task at `<repo>/.bode/tasks/<key>.md`, and opens an interactive AI session with the prompt as context. When the session exits, the planning artifact lands at `~/.bode/runs/<key>/planning.md`.

To advance:

```bash
bode continue <key>      # implementation
bode continue <key>      # review
bode continue <key>      # PR
bode done <key>          # mark done, switch to base branch
```

`bode` with no arguments prints help. (Auto-resume of the latest run is planned — see [ROADMAP.md](ROADMAP.md) §6.2.)

### From a tracker ticket

```bash
bode KD-312       # Jira
bode 123          # GitHub Issues (current repo)
bode ENG-42       # Linear
bode ABC12345     # Trello (card shortlink)
```

bode fetches the ticket, creates the branch (`feat/`, `fix/`, `chore/`, or `refactor/` based on issue type), and runs the planning phase. See [Trackers](#trackers).

### With explicit setup (recommended for teams)

```bash
bode setup           # global wizard: tracker, AI CLIs, VCS provider
bode setup-project   # per-project: workdir, default branch, context paths
bode setup-transitions   # map your tracker's workflow states to bode phases
```

---

## Trackers

| Tracker | Config key | Auth | Status |
|---|---|---|---|
| Jira | `tracker: jira` + `jira.{site, email, api_token}` | Basic auth | Production |
| GitHub Issues | `tracker: github-issues` | uses `gh` CLI auth | Production |
| Linear | `tracker: linear` + `linear.api_key` | API key | Beta |
| Notion | `tracker: notion` + `notion.{api_token, database_id}` | Integration token | Beta |
| Trello | `tracker: trello` + `trello.{api_key, token}` | Key + token | Beta |
| Local / plain-markdown | `tracker: local` *(default)* | none | Production |

Selection priority:

1. `tracker:` in project `.bode.yml` (if present)
2. `tracker:` in global `~/.bode/config.yml` (if present)
3. Jira if `jira.{site, email, api_token}` are all set
4. Local fallback otherwise

All trackers implement the same `IssueTrackerStrategy` interface — same commands, same artifacts, regardless of provider. Switch trackers with one config line; nothing in the orchestrator changes. See the [tracker docs](docs/trackers/overview.md) for per-provider details.

---

## Commands

| Command | Description |
|---|---|
| `bode <prompt-or-key>` | Fast path. Ticket key (e.g. `KD-312`) or freeform prompt. |
| `bode` *(no args)* | Print help. |
| `bode new <summary>` | Create a local task without invoking the AI. |
| `bode setup` | Interactive wizard. Tracker, AI CLIs, VCS provider. |
| `bode setup-project` | Per-project config (workdir, context paths, overrides). |
| `bode setup-transitions` | Map bode phases to your tracker's workflow states. |
| `bode start <KEY>` | Start a task. Creates branch, runs planning phase. |
| `bode continue <KEY>` | Advance to next phase. Creates PR at awaiting-merge. |
| `bode status <KEY>` | Show current phase, branch, PR link, conflict status. |
| `bode show <artifact> <KEY>` | Print artifact (`plan`, `implementation`, `review`) to stdout. |
| `bode log <KEY>` | Show the log of the current or last phase. |
| `bode list` | List all tracked tasks. |
| `bode abort <KEY>` | Cancel execution, clean up branch, reset tracker state. |
| `bode done <KEY>` | Mark done. Switch to base. Optionally merge PR. |
| `bode skills` | Show resolved skill paths and prompts. |
| `bode doctor` | Diagnose env, config, AI CLIs, VCS tooling. |
| `bode telemetry [on\|off\|status\|preview]` | Opt-in anonymous telemetry. |
| `bode compare <KEY> --agents <list>` | Run planning across multiple agents and compare. |

All commands support `--help`.

### Key flags

| Flag | Command(s) | Description |
|---|---|---|
| `--project <name>` | start, continue, fast path | Project name from `~/.bode/projects/` |
| `--from-branch <branch>` | start | Base branch (default: project `default_branch` or `main`) |
| `--auto` | start, fast path | Run all phases sequentially until PR created |
| `--dangerously-auto-merge` | start, fast path | Run all phases + merge PR + mark done (with warning) |
| `--dangerously-approve-all` | start, continue, fast path | Inject each CLI's bypass-approvals flag |
| `--auto-approve-pr-merge` | done | Automatically merge PR before cleanup |
| `--agents <list>` | compare | Comma-separated agents (e.g. `claude-code,codex`) |
| `-y, --yes` | abort, done | Skip confirmation |

---

## Auto mode

```bash
bode start KD-312 --auto
# planning → implementation → review → PR creation in one command
```

Stops after creating the PR so you can review it manually.

```bash
bode start KD-312 --dangerously-auto-merge
```

Runs all phases **and** auto-merges the PR. Shows a warning first. Use only on well-tested workflows.

---

## Hooks

User-defined shell commands run at lifecycle points. Configure in `.bode.yml` or global config:

```yaml
hooks:
  pre_implementation:
    - npm run lint:fix
  post_review:
    - run: ./.bode/hooks/notify.sh
      non_blocking: true
  post_pr:
    - run: gh pr ready
```

Hook points: `pre_planning` / `post_planning` / `pre_implementation` / `post_implementation` / `pre_review` / `post_review` / `pre_pr` / `post_pr`.

Each command runs in the project workdir with env vars:

- `BODE_TASK_KEY` — the task key (`KD-312`, etc.)
- `BODE_PHASE` — current phase (`planning`, `implementation`, `review`, `pr`)
- `BODE_HOOK` — hook point (`pre_implementation`, etc.)
- `BODE_WORKDIR` — absolute workdir path

Non-zero exit aborts the phase unless `non_blocking: true`.

---

## Configuration

### Resolution order

1. Project config: `~/.bode/projects/<name>.yml`
2. Local config: `<project>/.bode.yml`
3. Global config: `~/.bode/config.yml`
4. Built-in defaults

### Global `~/.bode/config.yml`

```yaml
tracker: jira           # or: github-issues | linear | notion | trello | local

jira:
  site: mycompany.atlassian.net
  default_project: KD
  email: you@company.com
  api_token: your-api-token

linear:
  api_key: lin_api_xxx  # or set LINEAR_API_KEY env var

notion:
  api_token: secret_xxx
  database_id: 00000000-0000-0000-0000-000000000000

trello:
  api_key: xxx
  token: xxx

vcs:
  provider: github      # or "gitlab"

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

hooks:
  pre_implementation:
    - npm run lint:fix

defaults:
  project: grid
```

### Project `<repo>/.bode.yml`

```yaml
name: grid
workdir: /home/user/projects/grid-stack
default_branch: main

tracker: github-issues   # this repo uses Issues even though global is Jira

context_paths:
  - .
  - ../grid-ui/src

context_files:
  - AGENTS.md
  - CLAUDE.md

phases:
  implementation:
    model: claude-opus-4-7   # opus for impl on this repo
```

### Local storage

```text
~/.bode/
├── config.yml              # global config
├── projects/               # per-project configs
├── runs/
│   └── <KEY>/
│       ├── meta.json       # task metadata, branch, PR, phase
│       ├── planning.log
│       ├── planning.md
│       ├── implementation.log
│       ├── implementation.md
│       ├── review.log
│       └── review.md
├── skills/                 # custom skill prompts
├── telemetry/              # opt-in event log (NDJSON)
└── comparisons/            # bode compare output

<repo>/
├── .bode.yml               # per-repo config (preferred)
└── .bode/
    ├── tasks/              # local tracker (no external tracker)
    │   └── <KEY>.md
    ├── skills/             # repo-scoped skills
    └── hooks/              # repo-scoped hook scripts
```

---

## Skills

Skills are markdown prompts that drive each phase. Plain files — edit without touching code.

### Resolution order

1. Project: `<repo>/.bode/skills/<phase>.md`
2. Global: `~/.bode/skills/<phase>.md`
3. Bundled default (shipped with bode)

First match wins. Copy a bundled skill to `~/.bode/skills/` and edit it.

### Bundled skills

| Skill | Phase | Purpose |
|---|---|---|
| `planning.md` | Planning | Produces an actionable plan from the ticket |
| `implementation.md` | Implementation | Executes the plan, runs validation, commits |
| `review.md` | Review | Critical code review with verdict (APPROVE / REQUEST_CHANGES) |

---

## Development

```bash
npm install

# Run from source via tsx
npm run dev -- setup
npm run dev -- start KD-312

# Validation
npm run check          # TypeScript
npm run lint           # ESLint
npm run format:check   # Prettier
npm test               # node --test via tsx
npm run build          # esbuild → dist/index.js

# Build SEA binary for current platform
node scripts/build-sea.mjs
```

See `AGENTS.md` for full workflow rules and `CONVENTIONS.md` for code standards.

---

## Troubleshooting

### Existing run detected

If a task already has a run, bode asks:
- **Abort and restart** — discards the previous run
- **Continue** — picks up where it left off
- **Cancel** — exits

### `bode` command not found

You haven't installed globally. See [Installation](#installation).

### Windows npm install from GitHub fails

Known npm 11 symlink bug on Windows. Use the tarball install method:

```bash
git clone https://github.com/KakunynQA/bode.git
cd bode
npm install
npm run build
npm pack
npm i -g bode-*.tgz
```

Or grab the `bode-win32-x64.exe` SEA binary from a release.

### Tracker connection fails

Run `bode doctor`. It checks auth for whichever tracker is configured and prints the exact fix.

For Jira: API token at <https://id.atlassian.com/manage-profile/security/api-tokens>.
For Linear: API key at linear.app → Settings → API.
For Notion: integration at <https://www.notion.so/my-integrations>, then share the database with it.
For Trello: <https://trello.com/app-key>.
For GitHub Issues: `gh auth login` (bode uses your existing `gh` auth).

### AI CLI not installed

Each phase requires an AI CLI. Install at least one:

- Claude Code: `npm i -g @anthropic-ai/claude-code`
- OpenCode: follow instructions at [opencode.ai](https://opencode.ai)
- Codex: `npm i -g @openai/codex`
- Z.AI (GLM models through claude-code / opencode / codex): `npx @z_ai/coding-helper init`

### "Permission denied" during AI session

Since v0.13.0 the AI CLI runs **interactively in your terminal** — you see the live session and approve tool calls in the CLI's own native UI.

Safety nets:

- **Preflight** checks `workdir`, `context_paths[]`, and `repos[].workdir` are readable. If not, the phase aborts before spending tokens.
- **`--dangerously-approve-all`** injects each CLI's bypass-approvals flag (claude: `--dangerously-skip-permissions`, codex: `--dangerously-bypass-approvals-and-sandbox`). For CLIs without an equivalent (opencode), bode warns upfront.

### AI exited without writing the artifact

When the AI exits without producing `~/.bode/runs/<KEY>/<phase>.md`, bode shows a yellow warning and asks `[retry | continue | abort]`. Inspect what happened with `bode log <KEY>`.

### Dirty workdir on `bode start`

bode prompts:
- **Stash** — auto-stash with `git stash push -m "bode:auto-stash:<TASK>"` and continue
- **Retry** — exits so you can handle it manually
- **Abort** — cancels

### `gh` / `glab` not found

Install the CLI for your VCS provider and authenticate:

- GitHub: `gh auth login`
- GitLab: `glab auth login`

### Phase timeout

Configurable per phase (`timeout_minutes` in `phases.<phase>`). Defaults: planning 15 min, implementation 60 min, review 10 min.

### Telemetry

Off by default. To enable:

```bash
bode telemetry on
bode telemetry status
bode telemetry preview     # last 10 events locally
bode telemetry off
```

Records command, success, duration, tracker kind, CLI adapter, versions, anonymous machine UUID. Never records task content, ticket IDs, code, paths, or credentials. Stored at `~/.bode/telemetry/events.ndjson`; no network unless `telemetry.endpoint` is configured.

---

## License

[MIT](./LICENSE) — Kakunyn
