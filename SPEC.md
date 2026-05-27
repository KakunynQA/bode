# Bode — Technical Specification (MVP)

## What Bode Is

Bode is a local CLI that orchestrates AI coding work through configurable phases (planning, implementation, review), driving native AI CLIs (Claude Code, OpenCode, Codex, etc.) and syncing progress to Jira so the team has shared visibility without leaving their existing workflow.

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
  ├─ Moves Jira status → "In Progress"
  ├─ Adds label "bode:planning"
  ├─ Comments on Jira: "🤖 Planning started with <model>"
  ├─ Runs planning phase (configured CLI + skill)
  ├─ Posts plan as Jira comment (full or summary+attachment if large)
  ├─ Updates label → "bode:planned"
  └─ Comments: "🤖 Plan ready. Review and run `bode continue KD-312`"

Developer reviews plan in Jira, approves implicitly by continuing:
  │
  ▼
$ bode continue KD-312
  │
  ├─ Validates current phase is "planned"
  ├─ Updates label → "bode:implementing"
  ├─ Comments: "🤖 Implementation started with <model>"
  ├─ Runs implementation phase
  ├─ Opens PR on GitHub/GitLab
  ├─ Updates label → "bode:reviewing"
  └─ Comments: "🤖 PR opened: <link>. Run `bode continue KD-312` to run review."

Developer continues to review phase (or skips and reviews manually):
  │
  ▼
$ bode continue KD-312
  │
  ├─ Runs review phase (AI self-review against checklist)
  ├─ Posts review summary as PR comment
  ├─ Updates label → "bode:reviewed"
  └─ Comments on Jira: "🤖 Self-review complete. Human review needed."

Human review and merge happen as normal. After PR merge:
  │
  ▼
$ bode done KD-312
  │
  ├─ Moves Jira status → "Done"
  ├─ Removes all "bode:*" labels
  └─ Comments: "🤖 Task complete. Artifacts archived locally."
```

## Autopilot Mode

If task has label `bode:autopilot`, `bode start` runs all phases sequentially without gates. Used once team trusts the prompts.

```bash
$ bode start KD-312
# Detects bode:autopilot label, runs planning → implementation → review automatically
```

## Tech Stack

- **Language:** TypeScript (strict)
- **Runtime:** Node.js >=18, built with esbuild to single CJS bundle
- **CLI framework:** `commander`
- **Interactive prompts:** `@inquirer/prompts` (arrow-key selection)
- **Jira integration:** MCP Atlassian server (mock adapter for MVP)
- **AI CLI invocation:** child_process (headless mode of each CLI)
- **Local storage:** filesystem (`~/.bode/`), no DB
- **Config:** YAML (`~/.bode/config.yml` + `<project>/.bode.yml`)
- **Tests:** `node --test` for units
- **Logging:** structured JSON logs to file, pretty output to terminal
- **Build:** esbuild → `dist/index.js` (CJS), assets embedded via `define`

## Directory Layout

### User home

```
~/.bode/
├── config.yml              # global config: Jira creds, default CLIs
├── runs/
│   └── KD-312/
│       ├── meta.json       # task metadata, current phase, timestamps
│       ├── planning.log    # raw output from planning CLI
│       ├── planning.md     # extracted plan
│       ├── implementation.log
│       ├── implementation.md
│       ├── review.log
│       └── review.md
└── skills/                 # default skill prompts
    ├── planning.md
    ├── implementation.md
    └── review.md
```

### Project (optional override)

```
<project-root>/
└── .bode.yml               # project-specific overrides
└── .bode/
    └── skills/             # project-specific skills (override global)
        ├── planning.md
        ├── implementation.md
        └── review.md
```

## Configuration Schema

### `~/.bode/config.yml`

```yaml
jira:
  site: kakunyn.atlassian.net
  # OAuth handled via MCP, no token here
  default_project: KD

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

jira_labels:
  planning: bode:planning
  planned: bode:planned
  implementing: bode:implementing
  reviewing: bode:reviewing
  reviewed: bode:reviewed
  autopilot: bode:autopilot

comment_format:
  plan_inline_max_chars: 3000  # plans longer than this get attached, summary inline
  use_emoji: true              # 🤖 prefix on Bode comments
```

### `<project>/.bode.yml` (overrides)

```yaml
phases:
  implementation:
    model: claude-opus-4-7  # this project needs Opus for implementation
```

## CLI Commands

| Command | What it does |
|---|---|
| `bode setup` | Interactive setup. Configures Jira OAuth, default CLI per phase, GitHub access. |
| `bode start <KEY>` | Starts task. Runs planning phase. Stops at gate unless autopilot. |
| `bode continue <KEY>` | Advances to next phase. |
| `bode status <KEY>` | Shows current phase, Jira link, last comment. |
| `bode show <artifact> <KEY>` | Prints artifact to stdout. Artifacts: `plan`, `implementation`, `review`. |
| `bode log <KEY>` | Tails the active log of the current phase. |
| `bode abort <KEY>` | Cancels current execution. Posts comment to Jira. Resets labels. |
| `bode done <KEY>` | Marks task as done. Moves Jira → Done. Cleans labels. |
| `bode list` | Lists all tasks currently tracked locally. |
| `bode skills` | Shows resolved skill paths and prompts. |

## Phase Execution Detail

Each phase follows the same pattern:

1. Load skill prompt from configured path (project override > global default).
2. Build context: Jira ticket description, all prior phase artifacts, project rules (`AGENTS.md` if present in repo).
3. Invoke configured CLI in headless mode with context as input.
4. Capture stdout/stderr to `runs/<KEY>/<phase>.log`.
5. Extract the artifact (plan/implementation summary/review) and save to `runs/<KEY>/<phase>.md`.
6. Post artifact to Jira (inline or summary+attachment depending on size).
7. Update Jira labels.
8. Exit with status code 0 on success, non-zero on failure.

## CLI Headless Invocation

| CLI | Invocation pattern |
|---|---|
| claude-code | `claude --print --model <model> < prompt.txt > output.log` |
| opencode | `opencode run --model <model> --prompt-file /dev/stdin` |
| codex | `codex exec --model <model> --prompt-file /dev/stdin` |
| zai | `zai-coding --model <model> --prompt-file /dev/stdin` |

Exact flags will be validated during implementation; some CLIs are still evolving. The orchestrator must abstract this behind a `CliAdapter` interface.

## Skill Prompt Structure

Each skill file is markdown with three sections:

```markdown
# Skill: Planning

## Role
You are a senior engineer planning the implementation of a Jira task.

## Context (injected by Bode)
<jira ticket>
<project AGENTS.md if exists>
<repo file tree>

## Instructions
- Output a plan as markdown with sections: Goal, Approach, Files to modify, Risks, Tests needed
- Do not write code in this phase
- If the task is ambiguous, list questions instead of guessing

## Output format
Pure markdown. No code fences around the plan itself.
```

Bode injects context between `<context>` markers automatically. The user only writes the role/instructions/format parts.

## Jira Integration

Bode talks to Jira via the **Atlassian MCP server**. Setup flow:

1. `bode setup` opens browser for OAuth dance via MCP.
2. Token stored securely (system keychain via `keytar`, fallback to encrypted file).
3. All Jira ops go through MCP: read issue, add comment, transition status, add/remove labels, attach file.

Bode does not implement Jira REST client directly. If MCP server is down, Bode reports clearly and exits.

## GitHub/GitLab Integration

For opening PRs at end of implementation phase:

- Detect remote (GitHub or GitLab) from git config.
- Use `gh` or `glab` CLI (must be authenticated by user separately).
- PR title from Jira ticket: `[KD-312] <ticket title>`.
- PR body includes: Jira link, plan summary, files changed summary, test results.
- PR is created against default branch unless `--base` flag given.

## Failure Modes

| Failure | Behavior |
|---|---|
| Jira MCP unreachable | Exit with clear error. No state changes. |
| CLI not installed | Exit with install instructions for that CLI. |
| CLI exits non-zero | Comment failure on Jira with last 50 lines of log. Reset label. |
| Phase timeout | Abort CLI process. Comment on Jira. User can `bode continue` to retry. |
| Network drop mid-phase | Local log preserved. User can `bode continue` to retry or `bode abort` to cancel. |
| Conflicting labels (`bode:planning` and `bode:implementing` both present) | Exit with diagnostic. User runs `bode abort` to reset. |

## Multi-Developer Coordination

Bode is local-only and stateless across developers. Coordination relies on Jira:

- **Assignee field:** dev who runs `bode start` becomes assignee.
- **Labels:** show current phase, visible to whole team.
- **Comments:** narrate progress.

If two devs run `bode start` on the same task simultaneously, second one detects existing `bode:*` label and refuses with: "Task already in phase X by @assignee. Run with --force if you really want to take over."

## Definition of Done (MVP)

- [ ] `bode setup` configures Jira OAuth, default CLIs per phase, validates connections
- [ ] `bode start <KEY>` runs planning phase end-to-end against a real Jira task
- [ ] Plan is posted as Jira comment (inline if small, summary+attachment if large)
- [ ] Jira status and labels update correctly
- [ ] `bode continue <KEY>` advances to implementation
- [ ] Implementation phase produces a real PR on GitHub
- [ ] `bode continue <KEY>` runs review phase, posts to PR
- [ ] `bode done <KEY>` cleans up state and closes Jira task
- [ ] Autopilot label runs all phases sequentially
- [ ] All commands handle network errors gracefully
- [ ] At least 2 CLI adapters working: claude-code and opencode (codex and zai also implemented)
- [ ] At least one phase has been configured per phase with a different CLI in a real test
- [ ] Unit test coverage for: config loading, CLI adapters, Jira ops, skill resolution
- [ ] Smoke test script that runs a fake task end-to-end against a Jira sandbox

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
| Native CLI (Claude Code, OpenCode) changes headless interface | CliAdapter abstraction; per-CLI integration tests |
| Plans of poor quality due to weak skill prompts | Skills are versioned in repo, iterate based on real usage |
| Two devs working same task | Label detection + assignee check + explicit `--force` flag |
| Plans grow too large for Jira comments | Auto-attachment fallback at 3000 chars |
| Token cost from AI CLIs | Each phase has timeout; failures don't auto-retry; cost tracking is post-MVP but logs preserve everything for manual audit |
