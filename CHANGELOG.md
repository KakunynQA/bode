# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
