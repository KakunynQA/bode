# Bode Roadmap

> **North star**: become the most-used CLI for orchestrating AI coding work in a dev's daily flow. Validated internally; the next year is about earning adoption.

Source of truth for direction. GitHub issues track the actual work; this file describes the **shape** of where we're going so future-us (or anyone else) doesn't accidentally rewrite the architecture.

---

## Where we are (May 2026)

The engine is built. Waves 0–6 are **functionally closed** (see `CHANGELOG.md`), with Wave 8 primitives now landed early to unlock Wave 7 delivery:

- ✅ Wave 0 — hardening (atomic meta, lockfiles, prompt-injection guard, exit-code gate)
- ✅ Wave 1 — solo-dev fast path (`bode <prompt>`, `.bode.yml`, `bode doctor`, optional tracker)
- ✅ Wave 2 — multi-tracker (Jira, GitHub Issues, Linear, Notion, Trello, plain-markdown)
- ✅ Wave 3 — DX polish (structured errors, SEA toolchain, Homebrew/scoop templates, opt-in telemetry)
- ✅ Wave 4 — public-release plumbing (release-SEA workflow, docs scaffold)
- ✅ Wave 5 — ecosystem hooks doable in-tree (plugin hooks, `bode compare`)
- ✅ Wave 6 — launch readiness in-tree features (neutral skills, strict gates, `bode init`, `bode learn`, HTML artifacts)
- ✅ Wave 7 in-tree primitives — feedback, replay/audit manifests, doctor reports, security/data-flow docs, Windows diagnostics
- ✅ Wave 8 primitives — scheduler, budgets, memory, trigger parser, multi-repo, community skills, integration skeletons

What's left from the old plan is gated on **external action** (npm publish, demo video, launch post, marketplace infra, GitHub App). Those don't ship more code — they ship a product.

This roadmap is about **shipping the product**.

---

## Strategy architecture (already in place — do not rewrite)

Bode follows a strategy pattern in three layers. Every new feature added in Waves 6+ MUST keep this contract intact.

### 1. AI CLI strategies — `CliAdapter`

Interface: `src/types/cli-adapter.ts`. Today: `ClaudeCodeAdapter`, `OpenCodeAdapter`, `CodexAdapter`. Registry: `src/adapters/cli/registry.ts`. Adding a new CLI is ~30 lines + one registry entry.

### 2. VCS strategies — `VcsAdapter`

Interface: `src/types/vcs.ts`. Today: `GitHubAdapter` (gh), `GitLabAdapter` (glab). Since v0.16.0 the AI creates the PR itself — this layer is mostly used by `bode done` for merge + `setup` for remote detection.

### 3. Issue tracker strategies — `IssueTrackerStrategy`

Interface lives on `src/types/jira.ts` (historical name, kept for backwards compat). Implementations: `MockJiraAdapter`, `RealJiraAdapter` (Jira REST v3), `GitHubIssuesAdapter`, `LinearAdapter`, `NotionAdapter`, `TrelloAdapter`, `LocalTrackerAdapter` (plain-markdown). Adding a new tracker = new file in `src/adapters/tracker/` implementing the same contract.

**Rule for Waves 6+**: every adoption-focused feature lands behind these three strategies. No leaky abstractions. No orchestrator changes for new providers.

---

## Phasing

Three waves, each one a step from "good engine" toward "product people use". Earlier waves don't get invalidated by later ones.

### Wave 6 — Launch readiness (next 4–6 weeks)

The work that has to happen between "engine done" and "people can actually find, install, and trust this thing".

#### 6.1 Distribution that doesn't make people read source

- **Publish `bode` to npm** (#21 carryover). `npm i -g bode` must work. Includes scoped automation for version bumps (script + CI gate).
- **Homebrew tap** (`KakunynQA/homebrew-bode`) auto-bumped on `v*` tags. Replace the `REPLACE_ME_ON_RELEASE` placeholders in `packaging/homebrew/bode.rb`.
- **Scoop bucket** same treatment for Windows.
- **SEA binaries on every release** — the workflow exists (`.github/workflows/release-sea.yml`); flip it from "build artifact" to "attach to release" with SHA256 sums.
- **Auto-update check** on `bode --version` (silent, opt-out via `telemetry off` or a new flag). One HTTP HEAD against the npm registry; warn if behind.

#### 6.2 First 60 seconds matter

- **`bode` (no args, fresh machine)** runs `doctor` automatically and offers `bode setup` if anything is missing. Today it shows help; that's a worse first impression than necessary.
- **Onboarding telemetry events** — `bode_first_run`, `bode_setup_completed`, `bode_first_task` (opt-in, anonymous, machine UUID). Wire to a basic dashboard so we know our funnel.
- **Error-to-fix loop** — every `errorChecklist` ends in "Run `bode doctor --fix`?". Today errors print suggestions; we never offer to apply them. Wire the obvious ones: missing config keys, missing CLIs (with brew/npm install command), missing `gh`/`glab` auth.

#### 6.3 Docs that actually exist

The VitePress scaffold is up but most pages are stubs. Fill in:

- `/guide/first-run.md`, `/guide/configuration.md`, `/guide/phases.md`
- `/guide/with-jira.md`, `/guide/with-github-issues.md`, `/guide/with-linear.md`, `/guide/local-only.md`
- `/reference/cli.md` (every command + every flag — `bode compare`, `bode telemetry`, `bode setup-transitions`, `bode doctor`, `bode new`, `bode fast`)
- `/reference/config.md` (the full YAML schema with examples per tracker)
- `/reference/skills.md`, `/reference/artifacts.md`
- `/trackers/{jira,github-issues,linear,notion,trello,local}.md`

Deploy target: Cloudflare Pages or Vercel (zero-cost). Custom domain (`bode.kakunyn.com` or similar).

#### 6.4 Trust signals on the README

- Working install badge (npm version, downloads/week once published, CI status)
- 60-second screencast (asciinema or terminalizer) embedded at the top
- "Used by" section once we have 3 real teams (not before — empty logo grids are tells)

#### 6.5 SPEC, AGENTS, README, CONVENTIONS, TESTING — full pass

These docs drifted during Waves 1–5. The factual errors are patched in this same PR; the content gaps still need filling:

- **README** still misses: `bode <prompt>` fast path, `bode new`, `bode doctor`, `bode compare`, `bode telemetry`, `bode setup-transitions`, hooks YAML, multi-tracker examples, `--dangerously-approve-all`, SEA install flow.
- **SPEC** still misses: command table updates, flag table updates, hooks lifecycle, comparison mode, tracker strategy section, telemetry semantics, `Out of Scope` cleanup (Linear/Notion/hooks are no longer out of scope).
- **AGENTS / CONVENTIONS** are mostly correct after this PR; spot-check after each Wave 6 ship.

#### 6.6 Neutral skills & per-model converter

- **Neutral skill source format** (#37) — author skills once as `*.neutral.md`, converter emits `*.claude.md` and `*.openai.md`. `src/skills/resolver.ts` picks the right flavor based on active `CliAdapter`. Resolver order: project > global > flavored > neutral.
- **`scripts/build-skills.mjs`** runs during `npm run build` to generate both flavors.

#### 6.7 Orchestrator discipline (ship rigor)

- **Plan-review phase** (#38) — new phase 1.5 between planning and implementation; AI returns structured verdict, loops back on `CHANGES REQUESTED`.
- **YAML frontmatter contract** per skill — `phase-runner.ts` parses and blocks on missing/invalid fields.
- **Validation gate** — `.bode.yml` `validation:` block; orchestrator runs commands, blocks PR on failure.
- **Release Discipline check** — `.bode.yml` `release:` block; validates version bump + changelog before commit.
- **HTML artifacts** + `bode show plan --html <KEY>`.
- All gated behind `bode start --strict` initially.

#### 6.8 Project context pipeline

- **`bode init`** (#40) — scaffolds `AGENTS.md` from best-practices meta-prompt via the configured AI CLI. Supports `--overwrite`, `--from <rules-file>`. Warns at `bode start` when neither `AGENTS.md` nor `README.md` exist.
- **`bode learn`** (#39) — auto-generates `<repo>/.bode/context.md` (stack, conventions, sensitive areas, glossary, anti-patterns) via AI CLI. Supports `--refresh`, `--detailed`. Context precedence: skill override > `.bode/context.md` > `AGENTS.md` > file tree.
- `bode doctor` warns when `context.md` is stale (>90 days + >50 commits).

#### 6.9 Definition of "done" for Wave 6

We can ship Wave 6 when:

1. `npm i -g bode` works for a stranger.
2. `bode "fix the dashboard bug"` works on a fresh machine in <60 s.
3. The docs site has every command documented with an example.
4. We have at least one real user (outside Kakunyn) who installed and ran it without our help.
5. Skills ship in both Claude and OpenAI flavors (#37).
6. `bode start --strict` enforces plan-review + validation gate + release discipline (#38).
7. `bode init` + `bode learn` produce usable context from a fresh repo (#39, #40).

---

### Wave 7 — Adoption (months 2–4 after launch)

What turns "released" into "trusted". Each item gated on **real signal from real users** — interviews, GitHub stars, Discord activity, npm downloads/week. **No telemetry-driven decisions in Wave 7** (see §What I'm explicitly NOT doing). Five user interviews beat 500 anonymous events for early-stage signal, and the "AI work stays local" brand promise is worth more than the data.

#### 7.1 Community surface

- **Public Discord** (`#bode-help`, `#bode-feedback`, `#bode-skills-share`). One channel beats none.
- **`good first issue` backlog** — at least 15 issues, each scoped to a single file change.
- **Examples repo** (`KakunynQA/bode-examples`) — one folder per workflow: "shipping a bugfix from a Jira ticket", "creating an MR on GitLab using OpenCode", "headless overnight run", "comparison run", etc.
- **Public roadmap board** (GitHub Projects, publicly visible) — this file points at it.
- **Weekly office hours** on Discord (1h, same time, replicable).

#### 7.2 Launch loop

- **Demo video (≤90 s)** — #23 carryover. Real task, real Jira ticket, real PR.
- **Launch post** — Hacker News, dev.to, X. Title angle: "Bode — orchestrate Claude / Codex / OpenCode for daily dev work, no data leaves your machine". Timing matters; aim for Tuesday US morning.
- **Comparison blog post** — "bode vs aider vs SWE-agent vs Cursor's agent mode". Honest matrix. Brings the SEO.
- **One conference talk** — submit to a regional Node/AI meetup. Bar is low; signal is high.

#### 7.3 Feedback loop (qualitative, not telemetry)

We learn from users by **talking to them**, not by collecting events. No funnels, no analytics endpoint, no aggregated dashboards. Wave 7 deliberately stops short of active telemetry because (a) `bode`'s brand is "AI work that stays local" and we shouldn't compromise it on a feature that produces selection-biased data anyway, and (b) qualitative signal at this stage is denser than quantitative.

- **`bode feedback`** — opens a pre-filled GitHub issue template (bode version, OS, configured CLI, configured tracker). Never auto-submits; user edits before posting.
- **5-user qualitative interviews** post-launch and once per quarter. Focus on first-week experience.
- **Weekly office hours** (see 7.1).
- **Public "what we're learning"** entry per release with non-feature observations from feedback.

The existing local telemetry feature (v0.27.0, opt-in, NDJSON at `~/.bode/telemetry/events.ndjson`, no network unless user configures an endpoint) **stays as-is**: useful for self-debugging, harmless because nothing leaves the machine. We do not configure a default endpoint and we do not market it as a feature.

#### 7.4 Replay / audit trail

For teams to trust AI on commits, runs must be reproducible. Reference dev tools all have this (browser devtools sessions, lighthouse reports, eslint --debug). Aider, Cursor's agent mode, Codex don't ship reproducible replay out of the box — clear differentiator.

- **`~/.bode/runs/<KEY>/manifest.json`** records: skill hash, AGENTS.md hash, file-tree snapshot hash, model, flags, env vars consumed.
- **`bode replay <KEY>`** rebuilds the exact prompt and reruns against the configured CLI.
- **`bode replay <KEY> --with-cli <other>` / `--with-model <other>`** lets you replay against a different combination — for model-upgrade smoke tests and cross-model comparison.
- **`bode replay --export <KEY>`** produces a portable bundle (`.bode-run` zip with manifest + artifacts + readable HTML).
- **`bode replay --import <bundle>`** lets anyone re-run a task another dev shared.

#### 7.5 Cost transparency (display only)

Users abandon AI tools when they fear runaway cost. Showing cost everywhere bode shows status is a confidence move, requires no new external infra, and is best-effort per `CliAdapter` (each CLI surfaces usage differently).

- **`bode list`** shows `~$X.XX` per task when the underlying CLI exposes usage.
- **`bode status <KEY>`** shows cost per phase.
- **`bode show plan <KEY>`** header includes total cost so far.
- Documented limits per adapter (some CLIs only expose tokens, not USD; convert via a static rate table).
- **NOT in Wave 7:** hard budgets, abort-on-breach, soft warnings. Those stay in Wave 8.4 once we know what good thresholds look like.

#### 7.6 Windows polish pass

Windows users hit more edge cases than macOS/Linux: PowerShell quoting, PATH-not-inherited shells, npm 11 symlink bugs, antivirus blocking `dist/index.js`, SmartScreen warnings on unsigned `.exe`. Reference CLI tools work flawlessly on Windows from day one (gh, deno, esbuild). Bode should.

- **Windows runner gates the release** (today only validates on ubuntu-latest is blocking; build-artifacts runs on windows-latest but doesn't gate).
- **`bode doctor` detects and flags**: PowerShell vs cmd vs WSL, paths with spaces, missing `gh` / `glab` on PATH, antivirus quarantine, npm 11 + Windows symlink issue.
- **README examples** show PowerShell side-by-side with bash where syntax diverges.
- **SEA binary signature**: explore code-signing the Windows `.exe` so SmartScreen doesn't warn on first run.

#### 7.7 SECURITY.md + data-flow doc

Mandatory for any team adoption. Doubles as marketing advantage given §7.3's no-telemetry stance.

- **`SECURITY.md`** at repo root: threat model summary, what bode reads/writes/sends, supported isolation modes, how to report a vuln.
- **Data-flow table** in `SPEC.md`: source → destination for every piece of data bode touches (skill, ticket body, code, tokens). Single page, no marketing fluff.
- **Untrusted-content handling** (already implemented per v0.18.0 `<untrusted>` markers) documented loudly with example.
- **Auditable**: a security-conscious reader verifies each claim against `src/` in ≤30 min.

#### 7.8 Slack / Discord webhook notifications

A `notifications:` block in `.bode.yml`:

```yaml
notifications:
  slack:
    webhook_url: ${env:SLACK_BODE_WEBHOOK}
    events: [phase_completed, pr_created, conflict_detected]
  discord:
    webhook_url: ${env:DISCORD_BODE_WEBHOOK}
    events: [pr_created]
```

Zero new dependencies — `fetch()` to the webhook URL. Useful for unattended `--auto` runs.

#### 7.9 `bode doctor --report`

Generates a redacted, human-readable health report (versions, configured tracker, CLI adapter, recent error count from local `~/.bode/runs/*/`). User pastes into a GitHub issue or Discord message. **Never auto-sent. Never collected.** Replaces the "Sentry-style error reporting" item from the previous Wave 7 draft.

#### 7.10 Definition of "done" for Wave 7

Wave 7 closes when:

1. **`bode replay <KEY>`** reproduces any run from v0.30+ byte-for-byte (prompt sent to the AI), supporting `--with-model` for cross-model comparison.
2. **`bode list` / `bode status`** show per-task and per-phase cost for at least the 3 supported CLIs (best-effort, documented limits).
3. **Windows CI gate** green on every release for 4 consecutive weeks. `bode doctor` detects the 4 most common Windows gotchas.
4. **`SECURITY.md`** + data-flow table published, linked from README's first 30 lines.
5. **Discord** has ≥50 active members; `#bode-help` median response time <24h.
6. **Launch post** published; ≥1 external case study (a real team, not Kakunyn) published.
7. **`bode feedback`** used by ≥10 distinct users (counted by GitHub issue label, NOT by telemetry).
8. **TTFPR P50 ≤ 5 min** validated via interview data from ≥10 users.

---

### Wave 8 — Daily-driver depth (months 4–8)

The features that make bode stick once people are using it for real. Each one expensive; each one only justified by Wave 7 signal.

#### 8.1 Parallel task execution

Today bode runs one task at a time, identified by lock files. Make it explicit:

```bash
bode start KD-312 &
bode start KD-313 &
bode list --watch
```

Requires: shared scheduling state (~/.bode/scheduler.json), per-task working trees (`git worktree` integration — careful, this is the hard part), aggregated logs.

#### 8.2 Full-flow comparison mode

`bode compare` today only does planning. Extend to:

```bash
bode compare KD-312 --agents claude-code,codex --phases planning,implementation
```

Produces side-by-side branches + draft PRs. Human picks the winner; the others get archived.

#### 8.3 PR-comment trigger

Most "agent-in-CI" products work by reading PR/issue comments. Bode should support:

- `/bode plan` in an issue → runs planning, posts plan as PR comment
- `/bode review` in a PR → runs review skill on the diff

Requires a thin server component (Cloudflare Worker or Vercel function) that auth'd customers point a GitHub App at. **Gated** on Wave 7 demand — don't pre-build.

#### 8.4 Cost budgets & enforcement

Display moved to Wave 7.5. This item is the enforcement half: optional hard budgets that abort runs when breached.

```yaml
budget:
  per_task_max_usd: 5
  per_phase_max_usd: 2
  abort_on_breach: true
  warn_at_pct: 80
```

Builds on the per-adapter usage parsing landed in 7.5. Why split: display is a confidence move that helps everyone today; enforcement only matters once teams have real cost patterns and we know what thresholds to suggest as defaults.

#### 8.5 Memory / preferences across runs

Today every task is stateless across sessions. A `~/.bode/memory/` directory with project-scoped notes (style preferences, gotchas, "last time we tried X, it failed because Y") that's injected into context. Opt-in per project.

#### 8.6 Multi-repo tasks

A task that spans `grid-api` + `grid-ui`. Already partially supported via `repos[]` in project config — extend so:

- Branch creation happens in each repo
- PR creation creates one PR per repo, linked in tracker comment
- Conflict checks run against each base branch
- `bode done` waits for all PRs to merge before marking done

#### 8.7 VS Code panel (deferred from old Wave 7)

Pick **VS Code** first (largest TAM, easiest WebView/Task API). Thin panel that:

- Lists `~/.bode/runs/<KEY>/` entries
- Shows current phase + log tail
- Buttons: "Continue", "Show plan", "Abort", "Replay"
- Does NOT duplicate the CLI — shells out to it

Deferred to Wave 8 because Wave 7's qualitative feedback (§7.3) must first show that users want a visual monitor for long-running tasks. If they're happy in the terminal, IDE integration is premature. JetBrains gated on VS Code proving useful.

#### 8.8 Curated skill library (deferred from old Wave 7)

Stop short of the full marketplace (Wave 9). Instead:

- Curated `skills/community/` folder in this repo, PRs welcome.
- `bode skills install <repo>#<path>` downloads a community skill into `~/.bode/skills/`.
- Versioning via git refs. No central registry.

Deferred because: the bundled skills must first mature (per-model flavor #37, neutral source, YAML contract per #38) before we incentivise third parties to write more.

---

### Wave 9 — Platform (only if Waves 6–8 land)

Hard-gated. None of this exists until adoption proves it should.

- **Skill marketplace** — central index of community skills, search, ratings, install via `bode skills add <slug>`. Requires server infra and moderation.
- **GitHub App** (#28 carryover) — issue-triggered runs at scale (the productized form of 8.3).
- **Web dashboard** — read-only view of `~/.bode/runs/` synced from telemetry stream. For teams that want shared visibility without giving the CLI write access to a SaaS.
- **Hosted runner** — opt-in cloud runners that pick up tasks from a queue. This is the only path to a real revenue model and we should not build it until at least 3 real teams ask for it with budget attached.

**Hard stop:** Wave 9 is forbidden until Waves 6–8 prove themselves. Building a marketplace / cloud for a tool no one uses is the most common death pattern for dev tools.

---

## What I'm explicitly NOT doing (still)

The "AI agent governance for enterprise teams" branch:

- Workflow DSL with declarative phases + gates + validations
- Policy engine
- RBAC / SSO / audit export
- "Agent HQ" multi-agent orchestration

These remain **valid product directions for a different product**. Bode's bet is that solo and small-team adoption beats top-down enterprise rollout. We don't pre-build for use cases we haven't validated.

If a real customer (paid, signed) asks for any of the above, that's signal — revisit then.

### Also explicitly NOT doing in Wave 7+

- **Active telemetry collection** — no analytics endpoint configured by default, no aggregated funnels, no "n% of users did X" dashboards. The local opt-in NDJSON feature from v0.27.0 stays for users who want to debug themselves; nothing leaves the machine unless the user explicitly configures an endpoint, and we do not ship a default one. Why: brand is "AI work stays local", selection bias makes opt-in telemetry numbers lie, and qualitative signal (interviews, Discord, GitHub issues) is denser at this stage. Revisit when (a) we have >500 daily-active users *and* (b) a question we can't answer through conversation.
- **Auto-update HTTP check on `bode --version`** — even silent registry pings change "no data leaves the machine" to "data leaves the machine". A `bode update` opt-in command is fine; auto-check is not.

---

## Migration discipline

When moving between waves, the rule is:

- **No breaking changes** to public CLI surface unless a major version bump.
- **No silent removal** of supported behaviors. If we deprecate, we ship one minor version with the old behavior working + a warning, then remove.
- **Internal refactors that don't touch UX** can happen any time.
- **Strategy interfaces** (`CliAdapter`, `VcsAdapter`, `IssueTrackerStrategy`) are public API — additions are fine, signature changes need deprecation cycle.

---

## How to use this document

- The phases above translate to GitHub Project columns: **Now (Wave 6)**, **Soon (Wave 7)**, **Later (Wave 8)**, **Future (Wave 9)**, **Done (Waves 0–5)**.
- Each phase has issues in the repo with labels `area:*`, `wave:6/7/8/9`, `priority:p0/p1/p2`.
- This file is the README of the roadmap; issues are the unit of work.
- When a wave completes, archive the column and move the next wave's issues into Now.

The GitHub Project: <https://github.com/KakunynQA/bode/projects> (see latest project).

---

## Appendix: archived waves (Waves 0–5)

Kept for context. Do not reopen.

- **Wave 0 — Hardening for internal validation** (v0.18–0.20) — exit-code gate, prompt-injection guard, atomic meta, lockfiles, IssueTrackerStrategy type alias.
- **Wave 1 — Solo-dev fast path** (v0.20–0.23) — `bode <prompt>`, `.bode.yml`, `bode` (no args), Jira optional, `bode doctor`.
- **Wave 2 — Multi-provider issue trackers** (v0.24–0.26) — GitHub Issues, Linear, Notion, Trello, plain-markdown, `bode new`, method rename.
- **Wave 3 — DX polish** (v0.27) — structured errors, SEA toolchain, Homebrew/scoop templates, opt-in telemetry.
- **Wave 4 — Public release prep** (v0.28 + #21/#23/#24 pending) — release-SEA workflow, docs site scaffold.
- **Wave 5 — Ecosystem (doable in-tree)** (v0.28) — plugin hooks, `bode compare` (planning-only).
