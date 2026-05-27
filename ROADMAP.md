# Bode Roadmap

> **North star**: become the most-used CLI for orchestrating AI coding work in a dev's daily flow. Grow gradually — validate internally first, expand provider coverage, then push for public adoption.

Source of truth for the direction. GitHub issues track the actual work; this file describes the **shape** of where we're going so future-us (or anyone else) doesn't accidentally rewrite the architecture.

---

## Strategy architecture (what's already there)

Bode already follows a strategy pattern in three layers. The next year of work is making sure each layer can absorb new providers without touching the orchestrator.

### 1. AI CLI strategies — `CliAdapter`

Interface: `src/types/cli-adapter.ts`. Today implemented by:

- `ClaudeCodeAdapter` (`claude`)
- `OpenCodeAdapter` (`opencode`)
- `CodexAdapter` (`codex`)

Registry: `src/adapters/cli/registry.ts`. Adding a new CLI is ~30 lines + one entry in the registry. **No engine changes needed.**

Per-adapter contract:
- `invoke(prompt, config, options)` — interactive or headless, with optional `dangerousBypass` and `workdir`
- `isAvailable()` — feature-detection during setup
- `dangerousFlags()` — returns the CLI's bypass-approvals flag, or `null` if the CLI has no equivalent

### 2. VCS strategies — `VcsAdapter`

Interface: `src/types/vcs.ts`. Today implemented by:

- `GitHubAdapter` (shells to `gh`)
- `GitLabAdapter` (shells to `glab`)

Note: since v0.16.0 the AI creates the PR itself; the VCS adapter is now used mainly by `bode done` for merge, and by `setup-project` for remote detection. Future: shrink this layer further.

### 3. Issue tracker strategies — `JiraAdapter` (current name; will broaden)

Interface: `src/types/jira.ts`. Today implemented by:

- `MockJiraAdapter` (no-op for tests / unconfigured)
- `RealJiraAdapter` (Jira REST v3 with ADF)

**The interface itself is provider-agnostic** even though the name is Jira-specific. Methods like `fetchTask`, `postComment`, `setStatus`, `setTag`, `listStatuses` would map cleanly to Linear, GitHub Issues, Trello, Notion, plain markdown TODO.

**The plan is to broaden the contract without breaking it.** Step 1: type alias `IssueTrackerStrategy = JiraAdapter` and start using the new name in engine.ts. Step 2: rename methods semantically (deprecating the old names with `@deprecated`). Step 3: build the next adapter (GitHub Issues is the easiest, Linear is the highest-demand). No rewrite, just renames + new classes.

---

## Phasing

Five waves. Each wave is incremental — earlier waves don't get invalidated by later ones.

### Wave 0 — Hardening for internal validation (now)

The features the analysis flagged as correctness/safety gaps. Cheap, high signal.

- Exit code gate: `exitCode !== 0` should mark the phase failed regardless of artifact presence.
- Prompt injection guard: wrap untrusted Jira/ticket content in a marked block and add a defensive instruction to bundled skills.
- Atomic `meta.json` writes (temp file + rename).
- Lockfile per task key — prevent two `bode start KD-X` from clobbering each other.
- Pin down `IssueTrackerStrategy` as a type alias for `JiraAdapter`. Document the contract.

### Wave 1 — Solo-dev fast path (next)

Drops the time-to-first-AI-call from ~15 min to ~30 s without breaking anyone's existing setup.

- `bode <prompt>` fast path — accepts a freeform prompt or `<TICKET-KEY>`. Auto-detects everything from CWD: git remote, `gh auth`, installed AI CLIs, project context files.
- `.bode.yml` in the repo root as the primary project config (still loads `~/.bode/projects/` for legacy).
- `bode` (no args) continues the latest run.
- Make Jira **optional** — when no Jira config is found and no ticket key is provided, run with a local-only task state (markdown file under `.bode/tasks/`).
- `bode doctor` — runs all the pre-flight checks and tells the user what's missing or misconfigured.

### Wave 2 — Multi-provider issue trackers (future, registered now)

The architectural step that pays off the "strategy pattern" investment. Build adapters in this order — easiest first:

1. **GitHub Issues** — same `gh` CLI we already shell to; trivial to wire.
2. **Linear** — high demand from dev-first teams; needs SDK + auth.
3. **Plain markdown TODO** — `.bode/tasks/*.md`; zero external dependency; default for "no tracker configured" case.
4. **Notion** — sizable demand from non-engineering-led teams.
5. **Trello** — niche but cheap to add; lots of users still on it.

Each adapter implements the same `IssueTrackerStrategy` contract. Engine doesn't change. `bode setup` adds them to the picker.

### Wave 3 — DX polish

Required for public adoption.

- `bode init` (rename of `setup`) with sane non-interactive defaults.
- Better error messages with concrete next-step suggestions.
- Homebrew / scoop / winget distribution in addition to npm.
- Distribute as standalone binary (esbuild → single-file via `pkg` or Bun-style); remove Node.js requirement for end users.
- Telemetry (opt-in) — anonymous usage to inform priorities.

### Wave 4 — Public release prep

- Publish to npm registry (currently `npm i KakunynQA/bode` via GitHub).
- Documentation site (Docusaurus or VitePress) replacing the README-only docs.
- Demo video (≤90 s) that shows the magic of `bode "fix bug"` → PR.
- HN / X / dev.to launch.

### Wave 5 — Ecosystem (only if Waves 0–4 validate)

Move from "tool" to "platform":

- Skill marketplace (community-contributed phase skills).
- Agent comparison (`bode start --compare claude,codex`).
- GitHub App for issue-triggered runs.
- Plugin hooks (pre-phase / post-phase user scripts).

**Hard stop:** Wave 5 is forbidden until Waves 0–4 prove themselves. Building a marketplace for a tool no one uses is the most common death pattern for dev tools.

---

## What I'm explicitly NOT doing (yet)

The "AI agent governance for enterprise teams" analysis suggested:

- Workflow DSL with declarative phases + gates + validations
- Policy engine
- RBAC / SSO / audit export
- Hosted dashboard / cloud SaaS
- Cost tracking per issue/model/agent
- "Agent HQ" multi-agent orchestration

These are **valid product directions for a different product**. Bode's bet is that solo and small-team adoption beats top-down enterprise rollout. We don't pre-build for use cases we haven't validated.

If a real customer (paid, signed) asks for any of the above, that's signal — revisit then.

---

## Migration discipline

When moving between waves, the rule is:

- **No breaking changes** to public CLI surface unless a major version bump.
- **No silent removal** of supported behaviors. If we deprecate, we ship one minor version with the old behavior working + a warning, then remove.
- **Internal refactors that don't touch UX** can happen any time.
- **Strategy interfaces** (`CliAdapter`, `VcsAdapter`, `IssueTrackerStrategy`) are public API — additions are fine, signature changes need deprecation cycle.

---

## How to use this document

- The phases above translate to GitHub Project columns: **Now**, **Soon**, **Later**, **Future**, **Done**.
- Each phase has issues in the repo with labels `area:*` and `priority:p0/p1/p2`.
- This file is the README of the roadmap; issues are the unit of work.
- When a wave completes, archive the column and move the next wave's issues into Now.

The GitHub Project: <https://github.com/KakunynQA/bode/projects> (see latest project).
