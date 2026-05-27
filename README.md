# Bode

<p align="center">
  <a href="https://github.com/KakunynQA/bode">
    <img alt="Version" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FKakunynQA%2Fbode%2Fmain%2Fpackage.json&query=%24.version&label=Version&style=for-the-badge">
  </a>
  <a href="https://nodejs.org">
    <img alt="Node 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js">
  </a>
  <a href="https://github.com/KakunynQA/bode/blob/main/package.json">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript">
  </a>
  <img alt="License" src="https://img.shields.io/badge/License-UNLICENSED-e74c3c?style=for-the-badge">
</p>

<p align="center">
  <strong>AI Coding Orchestrator for Jira</strong><br>
  Current version: <strong>0.1.0</strong><br>
  Drives <strong>Claude Code</strong>, <strong>OpenCode</strong>, <strong>Codex</strong> through configurable phases and syncs progress to <strong>Jira</strong>.
</p>

<p align="center">
  <a href="https://github.com/KakunynQA/bode">Repository</a>
  ·
  <a href="https://github.com/KakunynQA/bode/issues">Issues</a>
  ·
  <a href="#commands">Commands</a>
  ·
  <a href="#configuration">Configuration</a>
</p>

---

## Why Bode

**Bode** is a local CLI that orchestrates AI coding work through configurable phases (planning, implementation, review), driving native AI CLIs and syncing progress to Jira so the team has shared visibility without leaving their existing workflow.

It is a strong fit for:

- teams using **Jira** for task tracking
- developers using **Claude Code**, **OpenCode**, or **Codex** for AI-assisted coding
- projects that need **auditability** of AI-generated plans and reviews
- teams that want **shared visibility** of AI progress via Jira labels and comments

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
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

or with pnpm:

```bash
pnpm i -g KakunynQA/bode
```

### Install from source

```bash
git clone https://github.com/KakunynQA/bode.git
cd bode
npm install
npm run build
npm link
```

After installation, the `bode` command is available globally:

```bash
bode --version
bode --help
```

### Requirements

- **Node.js** >= 18
- At least one AI CLI installed: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenCode](https://opencode.ai), or [Codex](https://github.com/openai/codex)
- Jira account (connected via MCP Atlassian)

---

## Quick start

### 1. Run setup

```bash
bode setup
```

Interactive wizard that asks for your Jira site, project key, GitHub org, and which AI CLI to use for each phase. Saves to `~/.bode/config.yml`.

### 2. Start a task

```bash
bode start KD-312
```

Fetches the Jira ticket, runs the **planning** phase with your configured AI CLI, posts the plan as a Jira comment, and adds the label `bode:planned`.

### 3. Review plan and continue

Review the plan in Jira. When ready:

```bash
bode continue KD-312
```

Runs the **implementation** phase, opens a PR on GitHub, updates Jira labels.

### 4. Review and close

```bash
bode continue KD-312   # runs review phase
bode done KD-312 --yes # marks Jira as Done, cleans labels
```

---

## Commands

| Command | Description |
| --- | --- |
| `bode setup` | Interactive setup wizard. Configures Jira, CLIs, GitHub. |
| `bode start <KEY>` | Start a task. Runs planning phase. Stops at gate unless autopilot. |
| `bode continue <KEY>` | Advance to next phase (implementation → review → done). |
| `bode status <KEY>` | Show current phase, Jira link, last update. |
| `bode show <artifact> <KEY>` | Print artifact to stdout. Artifacts: `plan`, `implementation`, `review`. |
| `bode log <KEY>` | Show the log of the current or last phase. |
| `bode abort <KEY>` | Cancel current execution. Posts comment to Jira. Resets labels. |
| `bode done <KEY>` | Mark task as done. Moves Jira → Done. Cleans labels. |
| `bode list` | List all tasks currently tracked locally. |
| `bode skills` | Show resolved skill paths and prompts. |

All commands support `--help` for detailed usage.

---

## Configuration

### Resolution order

1. **Project config:** `<project>/.bode.yml` (overrides)
2. **Global config:** `~/.bode/config.yml` (main)
3. **Defaults:** built into Bode

### `~/.bode/config.yml`

```yaml
jira:
  site: mycompany.atlassian.net
  default_project: KD

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
```

### Local storage

```
~/.bode/
├── config.yml              # global config
├── runs/
│   └── KD-312/
│       ├── meta.json       # task metadata, current phase
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

# Build and link locally
npm run build
npm link
```

---

## Troubleshooting

### `bode` command not found

Make sure you installed globally:

```bash
npm i -g KakunynQA/bode
```

Or from source:

```bash
cd bode && npm run build && npm link
```

### Jira MCP unreachable

Bode talks to Jira via the Atlassian MCP server. Make sure the MCP server is running and configured. Run `bode setup` to reconfigure.

### CLI not installed

Each phase requires an AI CLI (claude-code, opencode, or codex). Install at least one:

- Claude Code: `npm i -g @anthropic-ai/claude-code`
- OpenCode: follow instructions at [opencode.ai](https://opencode.ai)
- Codex: `npm i -g @openai/codex`

### Phase timeout

Each phase has a configurable timeout (default: 15 min for planning, 60 min for implementation, 10 min for review). Increase in `~/.bode/config.yml` if needed.

---

## License

Internal — Kakunyn
