# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.16.0] — 2026-05-27

### Changed (architecture)

- **The AI creates the pull request, not bode.** When advancing from `reviewed` to `awaiting-merge`, bode no longer shells out to `gh pr create` / `glab mr create` with boilerplate title/body. Instead, it hands the terminal to the configured review-phase CLI with a focused prompt: "you just did the planning/implementation/review, now run `gh` (or `glab`) to open the PR, craft a meaningful title and body, then write the URL to `~/.bode/runs/<KEY>/pr.txt` and exit."
- The AI inherits stdio, so the user sees the live PR creation and can approve sandbox prompts directly.
- Bode reads `pr.txt` after the AI exits, extracts the URL (regex-anchored on `/pull/N` or `/-/merge_requests/N`), and persists URL + number in run meta.
- **Conflict check stays with bode** — fast, no tokens, runs before the AI handoff.
- `--dangerously-approve-all` propagates through to the PR-creation invocation.

### Added

- `src/orchestrator/pr-creator.ts` (`createPullRequestViaAI`) — composes the PR prompt with the three prior artifacts inlined and the handoff path. Exports `__testing` for unit tests on URL/number extraction and prompt construction.
- `CliInvocationOptions.workdir` — adapter `invoke()` now accepts `cwd` so the spawned CLI runs in the project workdir by default. Wired through phase-runner and pr-creator.

### Notes

- The bode-generated PR body (`Automated PR created by Bode for X / Summary / X / Powered by Bode`) is gone. PR bodies now describe the actual change.
- `branch-manager.ts#createPullRequest` is no longer called from the engine but remains in the file for any external caller that still depends on it. Will be removed in a future major bump if no consumers surface.
- 15 new unit tests cover URL extraction (github + gitlab + self-hosted) and prompt content. Total: 94 → 109.

## [0.15.0] — 2026-05-27

### Added

- **Configurable Jira transitions per project.** New `jira.transitions` block lets each project map its workflow's transition names (or target status names) to bode phases:
  ```yaml
  jira:
    transitions:
      planning: "In Progress"
      implementation: "In Development"
      review: "QA"          # or whatever your team calls it
      done: "Done"
  ```
  Resolution order: project YAML > global YAML > built-in defaults (`In Progress` / `In Review` / `Code Review` / `Done`). Fixes the common `Transition to "Code Review" not found` error on Jira workflows that use different status names.
- **Per-phase artifact paths printed to the terminal.** After each successful phase, bode prints the absolute paths of the log + markdown artifact so you can grep/open them directly.
- **End-of-task summary.** `bode done` (and `bode start --auto` / `--dangerously-auto-merge`) print a structured summary at the end with task key, status, branch, PR URL, conflict flag, and every artifact path under `~/.bode/runs/<KEY>/`.
- **`workdir` passed to `gh` / `glab`.** PR/MR creation now runs in the project's workdir (`cwd:`) instead of `process.cwd()`. Fixes wrong-repo PR creation when bode is invoked from a directory different from the configured workdir.

### Changed

- `gh pr create` failure with `Could not resolve to a Repository` now prints a structured diagnostic: workdir, local remote URL, and a 3-item checklist (repo existence, `gh auth status`, `git remote set-url`).
- `bode done` now uses the configured `jira.transitions.done` value (default `Done`) instead of hardcoding `Done`.
- `bode start --dangerously-auto-merge` uses the configured `jira.transitions.done` value when finalizing.

### Files

- New `src/config/transitions.ts` (resolver + defaults).
- New `src/cli/summary.ts` (`printPhaseArtifacts`, `printTaskSummary`).
- `src/orchestrator/engine.ts` reads transitions from config, prints artifact paths.
- `src/cli/actions/{done,start}.ts` print the full summary at end-of-task.
- `src/adapters/vcs/{github,gitlab}.ts` accept `workdir` and pass it as `cwd`.

## [0.14.0] — 2026-05-27

### Changed (breaking)

- **Flags renamed to the `--dangerously-*` family** for consistency with claude/codex conventions:
  - `--approve-all-dangerous` → `--dangerously-approve-all`
  - `--auto-and-merge-dangerously` → `--dangerously-auto-merge`
  Old names are not aliased. Update your scripts.

### Removed

- **`ZaiAdapter` removed.** Investigation showed that Z.AI's `coding-helper` (a.k.a. `chelper`) is **not** an AI coding agent — it's a config wizard that installs/configures *other* CLIs (claude-code, opencode, crush, factory-droid) to route through Z.AI's GLM models. The `zai-coding` command this adapter shelled out to does not exist.
- GLM models removed from `models.ts` under a dedicated `zai` entry. They remain listed under `opencode` (which can route to GLM via Z.AI configuration).

### Documentation

- `README.md` and `SPEC.md` now explain the recommended path for using Z.AI's GLM models: `npx @z_ai/coding-helper init`, pick `claude-code` or `opencode`, then configure that adapter in bode `setup`.

## [0.13.0] — 2026-05-27

### Changed (breaking architecture)

- **Phases now run interactively by default.** Bode hands the terminal over to the configured AI CLI via `stdio: 'inherit'` — you see the live session, approve tool calls, ask follow-ups, just like running `claude` or `codex` directly. Bode prepares the prompt (Jira ticket + project rules + file tree + prior artifact + handoff instructions) and waits for the process to exit.
- **Completion is detected via a file handoff.** The prompt instructs the AI to write its final artifact to `~/.bode/runs/<KEY>/<phase>.md` and exit. After exit, bode reads the file. If it's missing or empty, bode shows a yellow warning and asks the user `[retry | continue | abort]`.
- **`--auto` and `--auto-and-merge-dangerously` keep the old headless behavior** (stdout captured into the artifact) so unattended runs still work.

### Added

- **`--approve-all-dangerous` flag** on `bode start` and `bode continue`. Each adapter declares its own bypass flag via `dangerousFlags()`:
  - `claude-code` → `--dangerously-skip-permissions`
  - `codex` → `--dangerously-bypass-approvals-and-sandbox`
  - `opencode` → null (no equivalent flag exists)
  - `zai` → null (no equivalent flag exists)
  When the configured CLI returns `null`, bode warns upfront and asks whether to proceed (the user will need to approve actions interactively during those phases).
- `src/cli/dangerous-check.ts#planDangerousMode()` — checks every phase's CLI, warns about unsupported ones, asks for confirmation.
- `src/cli/missing-artifact.ts#handleMissingArtifact()` — interactive prompt when the AI session exits without writing the artifact.
- `CliInvocationOptions` type — adapter `invoke()` now takes `{ signal, interactive, dangerousBypass }`.
- Prompt builder appends a `<bode-handoff>` section telling the AI exactly where to write the artifact and to exit when done.

### Removed

- **Jira "Attention required" block.** Phase summary comments no longer carry the permission-issue snippet; warnings live in the user's terminal where they can react.
- `src/utils/output-scan.ts` and `src/utils/permission-warning.ts` — the post-hoc stdout heuristic and its pretty-printer are obsolete now that the user watches the AI session live. Preflight (filesystem-level upfront check) stays.
- `permissionIssue` field on `PhaseRunResult`.

### Fixed

- `BaseCliAdapter` now uses `node:child_process.spawn` with proper `StdioOptions` typing instead of a custom string-array shape.

## [0.12.0] — 2026-05-27

### Added

- **Preflight path check.** Before each phase invokes the AI CLI, bode now verifies that `workdir`, every `context_paths[]` entry, and every `repos[].workdir` is readable. If any path is missing or unreadable, the phase aborts with a structured error listing every offender — no tokens spent on a hopeless run. (Preflight A)
- **Permission-issue heuristic.** After a phase succeeds, bode scans `stdout`/`stderr` for known permission-refusal patterns (`permission denied`, `EACCES`, `need read access`, `grant permission`, `sandbox refused`, etc.). When a hit is found, the result carries a `permissionIssue` payload with the snippet and any filesystem paths mentioned. (Detection B)
- **User-facing warning.** `bode start` / `bode continue` print a yellow `⚠ CLI output mentions a permission/access issue` block listing the matched pattern, mentioned paths, output snippet, and remediation options. `bode start --auto` stops at the offending phase rather than silently advancing.
- **Jira summary now includes the warning block.** The phase comment ends with an `Attention required` section when a permission issue is detected, so reviewers see it on the card without opening the artifact.
- **AGENTS.md "Release Discipline" section.** Codifies the rule that every change must bump `package.json`, update `CHANGELOG.md`, refresh affected docs, rebuild `dist/`, and verify `bode --version`. Definition of Done checklist now enforces this.

### Changed

- `PhaseRunResult` success variant gains an optional `permissionIssue?: PermissionHit`. Existing callers continue to work unchanged.

## [0.11.1] — 2026-05-27

### Changed

- Version bump only; rebuilt dist matches v0.11.0 source.

## [0.11.0] — 2026-05-27

### Fixed

- **Critical:** Jira label mapping for `implementation` and `review` phases. Previously matched against keys named after `PhaseName` (`'implementation'`, `'review'`) but the configured labels are keyed by `PhaseStatus` (`'implementing'`, `'reviewing'`). Labels are now resolved through an explicit map. (B1)
- **Critical:** `bode done` now uses `meta.workdir` instead of `meta.projectName` when running git commands. Previously git ran in the wrong directory and failed silently. (B2)
- **Critical:** Review phase now transitions Jira card to `Code Review` (was `In Review`). (B3)
- **Critical:** `bode done` removes all `bode:*` labels and posts a completion comment. (B4)
- **Critical:** Jira REST adapter sends comment bodies as ADF (Atlassian Document Format) per v3 API; descriptions are decoded from ADF. Previously API calls failed with 400. (B5)
- `deepMerge` now replaces arrays instead of merging element-by-element. Previously corrupted `context_paths` / `context_files` when both project & global configs defined them. (B6)
- Skill defaults are now embedded into the bundle at build time and fall back through multiple filesystem candidates, so resolution works in dev, after `npm pack`, and after global install. (B7)
- All Jira REST calls now have a 30-second timeout (configurable via constructor). (B8)
- PR/MR URL parsing now uses regex anchored on `/pull/` and `/-/merge_requests/`, tolerant of warning lines and trailing query strings. (B9)
- `bode setup` now applies `chmod 0600` to `~/.bode/config.yml` on Unix. (B10)
- `BaseCliAdapter` truncates stdout/stderr at 5 MB to prevent memory blow-up from runaway CLIs.
- `BaseCliAdapter` properly removes abort listeners on process exit (no leaks).

### Added

- Embedded build constants: `__VERSION__`, `__SKILL_PLANNING__`, `__SKILL_IMPLEMENTATION__`, `__SKILL_REVIEW__`.
- `src/utils/version.ts` — resolves version from build-time define or package.json fallback (used by `bode --version` and the setup banner).
- `src/utils/fs.ts#chmodSensitive()` — best-effort permission-tightening for credential files.
- ADF helpers in `src/adapters/jira/adf.ts` (`textToAdf`, `adfToText`).
- Tests: `tests/unit/utils/merge.test.ts`, `tests/unit/utils/format.test.ts`, `tests/unit/skills/{resolver,prompt-builder}.test.ts`, `tests/unit/adapters/jira/{adf,factory}.test.ts`, `tests/unit/adapters/cli/registry.test.ts`, `tests/unit/adapters/vcs/{factory,url-parse}.test.ts`, `tests/unit/orchestrator/phase-runner.test.ts`, `tests/unit/storage/run-meta.test.ts`. Coverage went from 24 → 79 unit tests.

### Changed

- `package.json` declares a `files` whitelist (`dist/`, `src/skills/defaults/`, `src/assets/bode.art`, `README.md`, `LICENSE`) so npm packs only what is needed.
- ESLint now lints `tests/` (was excluded).
- CI now runs `npm test` and tests on Node 18, 20, 22, 24 (was 20/22/24 without tests).
- `bode --version` and the setup banner now read the live version from `__VERSION__`/`package.json` instead of a hardcoded string.

### Removed

- `bun.lock` (legacy from earlier Bun-runtime experiments).

## [0.10.1] and earlier

See git history.
