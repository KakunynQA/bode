# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.2] — 2026-06-01

### Fixed

- **ESC no longer erases the previous line.** Two related bugs in the raw-mode prompt render loop:
  - `handleEvents` unconditionally re-rendered after every stdin chunk even when `parseChunk` returned zero events (e.g., a lone ESC byte). Now early-returns when `events.length === 0`, so ESC is truly a no-op.
  - The cursor-up math was off by one. After writing N lines joined by `\n`, the cursor sits on the Nth row, so to return to the start of the block you move up `N - 1` rows — not `N`. The previous `\x1b[${lastRenderHeight}A\x1b[0J` overshot by one row, landing on (and erasing) the previous prompt's line. Replaced with: skip move-up entirely when `lastRenderHeight === 1`, otherwise `\x1b[${lastRenderHeight - 1}A` then `\r\x1b[0J`. The v2.3.0 `firstRender` flag (which masked this for the first paint only) is gone — initial `lastRenderHeight = 0` now serves the same purpose without papering over the math bug. Applied to all 5 prompts: `askInput`, `askSelect`, `askSearch`, `askPassword`, `askInputWithAtTrigger`.

## [2.3.1] — 2026-06-01

### Changed

- Republished tarball — no functional changes from 2.3.0. Bumping to force `npm i -g` to replace a previously installed 2.3.0 build.

## [2.3.0] — 2026-06-01

### Removed

- **ESC back-navigation removed from setup wizards.** The `noBack` option, `BACK` sentinel, `BackError`, `WrapOptions`, the `'esc'` `KeyKind`, and every back-navigation branch in `src/utils/prompt.ts` reducers and finishers have been deleted. ESC is now a no-op everywhere — lone ESC bytes from PowerShell readline are swallowed by `parseChunk`. Callers (`setup.ts`, `start.ts`, `setup-transitions.ts`, `setup-project-investigate.ts`, `missing-artifact.ts`, `dangerous-check.ts`) updated to drop the `firstStep` / `noBack` plumbing and the directional step-divider hint.

### Fixed

- **First-render no longer eats the previous line.** Every raw-mode prompt (`askInput`, `askSelect`, `askSearch`, `askPassword`, `askInputWithAtTrigger`) used to start its render loop with `\x1b[1A\x1b[0J`, which moved the cursor onto the previous prompt's confirmed output (or a wizard divider like `── Planning Phase ──`) and erased it. Render closures now track a `firstRender` flag and skip the cursor-up-and-clear on the first paint. The bug shipped silently with the v2.2.0 raw-mode rewrite; only became visible once the printFooterHint compensation went away.

## [2.2.0] — 2026-06-01

### Changed

- **Prompt layer rewritten from scratch.** `askInput`, `askSelect`, `askPassword`, and `askSearch` in `src/utils/prompt.ts` no longer delegate to `@inquirer/prompts`. Each prompt now owns stdin in raw mode with its own keypress parser (`parseChunk` + per-prompt reducer), matching the architecture that `askInputWithAtTrigger` already used successfully. This eliminates the root cause of v2.1.4–v2.1.8 ESC handling bugs: three actors (readline, inquirer, our BackError signal) fighting over stdin in PowerShell + Windows Terminal.
- `parseChunk` now emits `up` / `down` key events for `\x1b[A` / `\x1b[B` CSI sequences (previously ignored). Required for `askSelect` and `askSearch` arrow-key navigation.
- `handlePromptError` simplified — no longer checks for `ExitPromptError` / `AbortPromptError` from inquirer. Ctrl+C in prompts now throws `TerminateShellError` directly.
- All direct `@inquirer/prompts` imports in `project-resolver.ts`, `start.ts`, `setup-transitions.ts`, `dangerous-check.ts`, and `missing-artifact.ts` replaced with `askSelect` / `BACK` from `~/utils/prompt.ts`.
- `Separator` is now a custom class (no longer re-exported from inquirer).

### Removed

- `@inquirer/prompts` and `@inquirer/core` dependencies removed from `package.json`.
- `createBackSignal()`, `runWithBackSignal()`, `isBackAbort()` internal helpers removed (no longer needed).
- `createCancelSignal()` deprecated shim now returns a no-op signal.
- ESC debug log infrastructure (`BODE_ESC_DEBUG`, `esc-debug.log`) removed.

### Added

- `reduceInputState` reducer for `askInput` (same as `reduceKeystroke` but `@` is a regular char).
- `reduceSelectState` reducer for `askSelect` with arrow navigation, pagination, and disabled-item skipping.
- `reduceSearchState` reducer for `askSearch` with input editing, list navigation, and async source debouncing.
- `clampCursor` helper for select pagination.
- Comprehensive unit tests for all new reducers and extended `parseChunk`.

## [2.1.8] — 2026-06-01

### Changed

- Wizard step divider now shows direction: `── ← back to 3 / 8 ──` (yellow
  arrow) when ESC navigates back; `── step 4 / 8 ──` (dim) on a normal
  advance. Without this cue the back navigation looked identical to
  Enter-advancing because new prompts render below old ones — terminals
  don't scroll backwards.
- `BODE_ESC_DEBUG` is opt-in again (default off). The 2.1.6 default-on
  served its purpose: the captured log revealed PowerShell readline marks
  standalone ESC presses with `key.meta = true`, which was the root cause
  fixed in 2.1.7. Set `BODE_ESC_DEBUG=1` to re-enable for future debugging.

## [2.1.7] — 2026-06-01

### Fixed

- ESC inside `setup` / `setup-project` / `setup-transitions` wizards
  finally works on PowerShell + Windows Terminal. Root cause confirmed
  from the 2.1.6 debug log: readline reports a standalone ESC press
  with `key.name === 'escape'` AND `key.meta = true`, even when no Alt
  modifier was held. The 2.1.4 dual-listener was rejecting it on the
  `!key.meta` filter. We now accept `key.escape` regardless of the meta
  flag (ctrl+esc and shift+esc remain ignored — they are different
  intended keystrokes).

## [2.1.6] — 2026-06-01

### Added

- Wizard step indicator: a `─── step X / N ───` divider prints above
  each `setup` / `setup-project` / `setup-transitions` question so the
  user always sees where they are in the flow. Not a true sticky footer
  (that needs a separate Ink rewrite of the wizard itself); scrolls up
  with subsequent output but keeps the user oriented.

### Changed

- `BODE_ESC_DEBUG` is now **on by default**. The v2.1.5 opt-in path was
  too easy to miss across terminals / shell sessions. The log lives at
  `~/.bode/esc-debug.log`, one JSONL line per stdin event. Opt out via
  `BODE_ESC_DEBUG=0`.

## [2.1.5] — 2026-06-01

### Added

- Opt-in stdin debug log to diagnose ESC delivery on PowerShell + Windows
  Terminal. Set `BODE_ESC_DEBUG=1` before launching bode — every
  `data` / `keypress` event during an inquirer wizard prompt is appended
  to `~/.bode/esc-debug.log` as JSONL. The log captures chunk hex,
  keypress name, sequence bytes, and stdin state (raw mode, TTY, listener
  counts) so we can pinpoint why ESC is not firing in 2.1.4.

## [2.1.4] — 2026-06-01

### Fixed

- ESC inside `setup` / `setup-project` / `setup-transitions` wizards did
  not navigate back (or cancel the wizard at the first step) on PowerShell
  - Windows Terminal. Root cause: `createBackSignal` in `src/utils/prompt.ts`
    relied on the raw stdin `'data'` event delivering ESC as a 1-byte chunk
    (`chunk.length === 1 && chunk[0] === 0x1B`). PowerShell + inquirer's
    readline does not consistently deliver ESC this way. Same fundamental
    issue we fixed for the `@` trigger in v2.0.4.
- Fix: `createBackSignal` now runs two listeners in parallel — readline
  `keypress` events (the path inquirer itself uses) AND the existing
  byte-sniff fallback. Whichever fires first wins. Reliable across
  PowerShell, Windows Terminal, Git Bash, and POSIX TTYs.

## [2.1.3] — 2026-05-31

### Fixed

- ESC at the idle TUI prompt (added in 2.1.2) did not actually fire on
  some terminal + Node combinations because Ink's `useInput` does not
  always set `key.escape` for a standalone ESC press — the raw 0x1B byte
  lands in `input` instead. PromptInput now accepts both forms.

## [2.1.2] — 2026-05-31

### Added

- ESC at the idle TUI prompt now clears the in-progress command (buffer,
  cursor, history pointer, and stashed draft). Pressing ↑ after clearing
  starts from a clean slate at the newest history entry.

## [2.1.1] — 2026-05-31

### Changed

- TUI autocomplete is now **inline ghost text**, Claude-Code style. As the
  user types at the idle prompt, the next-matching subcommand or flag is
  appended in dim text after the cursor (the inverse-caret sits on the
  first ghost character). When multiple candidates match, the first in
  declaration order wins. Tab no longer prints a candidate list — it
  accepts the visible ghost. Pressing Tab with no ghost is a no-op.
- `completeBuffer` removed; replaced by `ghostCompletion(buffer, cursor) →
string` (empty string = no ghost). Tests rewritten accordingly.

## [2.1.0] — 2026-05-31

### Added

- Interactive shell now supports **persistent command history**. ↑/↓ cycle
  through previously submitted commands; history is stored in
  `~/.bode/history` (one command per line, chronological, capped at 250
  entries) and shared across sessions. Identical consecutive entries are
  collapsed (bash `HISTCONTROL=ignoredups`). Writes are atomic via
  tmp-file + rename; concurrent shells are last-writer-wins.
- Interactive shell now supports **Tab autocomplete** on the first token
  (subcommands + builtins) and on flag-shaped tokens (per-subcommand
  flag list). Single matches insert inline; multiple matches print a
  candidate list above the prompt. Positional tokens (ticket keys,
  file paths) are not completed in 2.1 — possible future work.

### Changed

- **Ctrl+C semantics.** In the interactive shell, Ctrl+C now _always_
  terminates the bode process — including mid-wizard and during a
  spawned AI CLI. Previously Ctrl+C only cancelled the active prompt
  and returned to the shell prompt. The per-action cancel role moves to
  ESC, which now also cancels the entire wizard when pressed at the
  first step (was: "(nothing to go back to)" + re-prompt loop).
  Implemented via a new `TerminateShellError` that escapes
  `runActionGuarded` so `runShell` can exit cleanly.
- TUI prompt rewritten as a custom Ink `useInput` component (replaces
  `ink-text-input`). It owns the line buffer + cursor + history pointer
  and intercepts Ctrl+C / Tab / ↑↓ before any default Ink handler. Ink
  is now mounted with `exitOnCtrlC: false`.
- TUI footer keybinding hint updated to
  `(↵ run · ↑↓ history · tab complete · ctrl+c exit)`.
- SPEC.md §Shell Mode and README.md v2.0.0 callout updated to document
  the new keybindings + history file format.

### Fixed

- `setup-project` `@` file picker now reliably scans the workdir the
  user typed in the "Working directory (absolute path):" question. The
  workdir is normalised to an absolute path via `path.resolve()` before
  any picker call, so a relative or `.` workdir cannot leak the cwd of
  the launching shell into the scan (root cause of the report: "@ scans
  bode's own folder when the TUI is launched from there"). A new
  `Scanning <abs path> for candidate files` diagnostic line is printed
  above each context-files question so the user can confirm the scope
  before opening the picker.

## [2.0.4] — 2026-05-31

### Fixed

- `setup` / `setup-project` context-files question: the `@` trigger now
  reliably opens the fuzzy file picker on the first keystroke across
  PowerShell, Windows Terminal, Git Bash, and POSIX TTYs. The previous
  implementation raced an inquirer `input()` prompt against a stdin
  byte listener checking for a single-byte 0x40 chunk and lost the race
  on Windows, leaving `@` as a literal character in the input buffer.
  Replaced with a small raw-mode keypress prompt that owns stdin for
  the duration of the question, matching Claude Code's inline `@` file
  mention behaviour. The line-editing state machine is a pure reducer
  with unit-test coverage of every key transition.

## [2.0.3] — 2026-05-30

### Fixed

- TUI shell exited cleanly with code 0 (and earlier with a `Cancelled.`
  print) the instant any interactive wizard — `setup`, `setup-project`,
  `setup-transitions` — rendered its first `@inquirer/prompts` question.
  Real root cause: Ink's `componentWillUnmount` calls
  `process.stdin.unref()` when it disables raw mode. Inquirer's
  `readline.createInterface` then schedules its first render via
  `setImmediate` without re-`ref()`-ing stdin, so between those two
  ticks the Node event loop has nothing keeping it alive, fires
  `beforeExit`, and the process exits — not from `process.exit`, not
  from a signal, not from `signal-exit`. The fix re-refs stdin after
  Ink unmounts (`src/tui/shell.ts`) and again before every prompt
  (`src/utils/prompt.ts.runWithBackSignal`). Verified with a
  deterministic PTY harness at `scripts/debug-bode-pty-single.mjs`.

### Removed

- `runActionGuarded` no longer monkey-patches `process.emit('exit', …)`
  — that swallow was a 2.0.1/2.0.2 attempt to mute the symptom and is
  dead with the real fix in place. `process.exit` and
  `process.reallyExit` interception stay (they protect against the 70+
  `process.exit(1)` calls action files still make on usage errors).

## [2.0.2] — 2026-05-29

### Fixed

- Real fix for the "Cancelled." right after every wizard prompt — the
  2.0.1 attempt only patched `process.emit` which `signal-exit` re-wraps
  after us. Now the dispatcher eagerly imports `@inquirer/prompts` so
  `signal-exit`'s singleton emitter exists at startup, then patches that
  emitter's `emit` method directly while the action runs (and resets the
  `emitted` flag so a previously-fired exit can't short-circuit it).

## [2.0.1] — 2026-05-29

### Fixed

- TUI shell would print "Cancelled." and exit the moment any action that
  used an `@inquirer/prompts` wizard rendered its first prompt — even
  when the user never pressed Ctrl+C. Root cause: `signal-exit` (used by
  inquirer to detect process termination) was firing a spurious `'exit'`
  event during the Ink → inquirer handoff. The dispatcher now intercepts
  `process.emit('exit', ...)`, `process.reallyExit`, and `process.exit`
  for the duration of an action, then restores the originals.
- Render loop now awaits Ink's `waitUntilExit()` and yields one
  `setImmediate` tick before dispatching, so raw mode and stdin
  listeners have fully drained before inquirer takes the terminal.
- `handlePromptError` now throws `CancelledError` instead of calling
  `process.exit(0)`, and the dispatcher recovers transparently so the
  shell stays alive after a wizard cancel.

## [2.0.0] — 2026-05-29

Breaking release. Bode is now an interactive TUI shell. Running `bode`
launches a persistent screen with a header (version + project + tracker),
an input prompt in the middle, and a footer (active run + last exit code +
keybinding hint). Every command is typed inside the shell without the
`bode ` prefix.

### Breaking

- `bode <subcommand>` (`bode setup`, `bode start KD-1`, `bode "fix the
bug"`, etc.) no longer runs as a one-shot CLI. Launch the shell with
  `bode`, then type `setup`, `start KD-1`, or `"fix the bug"` at the
  prompt.
- `--auto`, `--strict`, `--dangerously-auto-merge`, `--dangerously-approve-all`,
  and every other flag are typed inside the shell: `start KD-1 --auto`.
- `npm run dev -- setup` becomes `npm run dev`, then type `setup` inside
  the shell.
- The internal commander program (`src/cli/program.ts`, `src/cli/commands.ts`)
  has been removed. The dispatcher (`src/tui/dispatcher.ts`) routes typed
  lines directly to the existing action functions.
- Distribution format is now ESM. `package.json` has `"type": "module"` and
  `scripts/build.mjs` emits an ESM bundle with a `createRequire` shim. The
  Node SEA toolchain may need a follow-up for the new format.
- CI workflows or scripts that invoked `bode <subcommand>` headlessly will
  break. Headless invocation will return in a future minor release behind
  an explicit `--exec` flag.

### Added

- Interactive TUI shell powered by Ink (`src/tui/`): persistent header,
  prompt, footer, fresh state load before every render.
- Built-in shell commands: `help` / `?`, `clear`, `exit` / `quit` / `:q`.
- `bode --version` and `bode --help` remain as headless escape hatches.
- TTY guard: a non-TTY stdin (piped, background) exits 2 with a friendly
  error pointing at `--version` / `--help`.
- `ink`, `ink-text-input`, `react`, `react-devtools-core` as runtime deps
  (the last is stubbed at bundle time via `src/tui/stubs/`).

### Changed

- Entry point (`src/index.ts`) detects `--version` / `--help` and otherwise
  launches `runShell()` from `src/tui/shell.ts`.
- `src/skills/resolver.ts` and `src/utils/version.ts` now derive their
  module directory via `import.meta.url` under ESM, with the CJS
  `__dirname` fallback preserved.

### Removed

- `src/cli/program.ts` and `src/cli/commands.ts` (commander program).
- The temporary `src/tui/__smoke.tsx` introduced during the build-config
  bring-up.

### Known limitations

- Fatal errors inside action functions (those that call `process.exit`)
  terminate the shell process; the user has to re-launch `bode`. A
  follow-up will refactor the actions to throw and let the dispatcher
  recover.
- The `cmd.exe` legacy host on Windows may glitch around raw mode. Use
  Windows Terminal or the VS Code terminal.
- Bundle grows from ~2.1 MB to ~3.4 MB because Ink and React are inlined.

## [1.3.1] — 2026-05-29

### Fixed

- `setup-project` context file input now opens the fuzzy file picker immediately when `@` is typed, instead of requiring Enter after `@`.

## [1.3.0] — 2026-05-29

Setup wizard overhaul. Single context-files question with `@` file picker and auto-detected defaults, optional AI-driven project context investigation written to `PROJECT_CONTEXT.md`, and uniform ESC=back / Ctrl+C=cancel keybindings across every prompt.

### Added

- `bode setup-project` now opens with an "Investigate & document project context" step that runs the chosen CLI/model against the workdir and writes `PROJECT_CONTEXT.md`. Cached at `~/.bode/projects/<name>/PROJECT_CONTEXT.md` by default.
- `--shared-in-repo` flag on `setup-project`: write `PROJECT_CONTEXT.md` to the workdir instead (committable, team-shared). Prompts before overwriting an existing file.
- `--refresh-context` flag on `setup-project`: re-run only the investigation step on an existing project, preserving everything else.
- `@` trigger inside the context-files question opens a fuzzy file picker (`@inquirer/search`) over the workdir. Works for the primary workdir and each additional repository.
- Auto-detected context-file defaults expanded to include `CLAUDE.md`, `AGENTS.md`, `CODE_CONVENTIONS.md`, `CONVENTIONS.md`, `.cursorrules`, `GEMINI.md`, `.github/copilot-instructions.md`, `.claude/CLAUDE.md`, `CONTRIBUTING.md`. Only files that exist on disk are pre-selected.
- Each additional repository in `setup-project` now has its own context-files question with the same auto-detect + `@` picker behavior.
- New project YAML fields: `project_context_path` (absolute path to PROJECT_CONTEXT.md) and `context_investigated_at` (ISO 8601 timestamp). Both are consumed by `gatherContext` and surfaced in `bode doctor`.

### Changed

- **Wizard keybindings:** single ESC now goes back to the previous question. Ctrl+C cancels the wizard cleanly (was: double-ESC). A dimmed footer hint `(esc to go back · ctrl+c to cancel)` is printed below every prompt. The very first step shows `(nothing to go back to)` if ESC is pressed there.
- "← Back" choice items removed from every wizard select — ESC replaces them globally.
- Context-files question now supports comma-separated input AND the `@` file picker in the same field.
- `gatherContext` prepends `PROJECT_CONTEXT.md` content (when configured and present) to the AI's context block, ahead of `.bode/context.md`, project memory, and per-file context.

### Removed

- The "Context paths" wizard question is gone. Existing project YAMLs with `context_paths` continue to load without error; the field is now ignored at runtime and dropped on next save. A one-line dim warning is printed when loading a deprecated YAML for edit.
- `PreflightIssue.source` no longer includes `'context_paths'`. Preflight checks the workdir and additional repos only.
- The internal `generateFileTree(workdir, contextPaths)` signature simplified to `generateFileTree(workdir)` — the file tree always walks from the workdir root.

## [1.2.0] — 2026-05-29

Wave 7 / milestone 8 adoption release. Adds qualitative feedback, reproducible replay/audit primitives, cost visibility refinements, Windows doctor diagnostics, and security/data-flow documentation.

### Added

- `bode feedback` prints or opens a pre-filled GitHub issue URL without auto-submitting data.
- `bode replay <KEY>` records per-phase prompt manifests, replays saved prompts, and exports/imports `.bode-run` bundles.
- `bode doctor --report [path]` writes a redacted local support report and includes Windows shell/PATH/npm symlink checks.
- `SECURITY.md` and a SPEC data-flow table for what Bode reads, writes, and sends.
- Bode workflow commands for watchdog, research delegation, debug delegation, and auto memory-log mode.

### Changed

- `bode status` now shows per-phase cost when usage data exists.
- `bode show <artifact> <KEY>` prints a cost-so-far header.
- Version bumped to `1.2.0` for Wave 7 CLI additions.

## [1.1.0] — 2026-05-29

Wave 8 / milestone 9 daily-driver depth release. Adds local scheduler state, watch/cancel surfaces, budget enforcement hooks, project memory, trigger parsing, multi-repo planning primitives, community skill install scaffolding, and packaging skeletons for server/IDE integrations.

### Added

- Scheduler state at `~/.bode/scheduler.json`, `bode list --watch`, and `bode cancel <KEY>`.
- Worktree manager primitives for Wave 8 isolated task execution.
- `budget:` config schema and pre-phase budget enforcement hooks.
- Project memory store plus `bode memory init|show|add|edit|prune|off`.
- `.bode/context.md` prompt layering now supports opted-in project memory.
- `bode trigger-test` and `/bode plan|fix|review` trigger parser.
- `bode compare --phases`, `--show`, `--diff`, `--pick`, and `--pr-each` CLI surface.
- Multi-repo runner planning primitive and expanded `repos[]` schema (`role`, `optional`, `path`).
- Community skill example and `bode skills install|list|remove|search|audit|update` management surface.
- GitHub App manifest, runner shim, webhook worker skeleton, and VS Code panel contract docs.

### Changed

- `bode list` and `bode status` show best-effort task cost.
- Version bumped to `1.1.0` for Wave 8 CLI/config additions.

## [1.0.0] — 2026-05-28

Wave 6 launch-readiness release: model-aware skills, strict delivery gates, generated project context, and first-run repo initialization.

### Added

- Neutral skill sources plus `scripts/build-skills.mjs`, generating Claude and OpenAI-flavored bundled prompts during `npm run build`.
- `plan-review` phase support with `plan_review` phase config, lifecycle statuses, and strict contract validation via `--strict`.
- Validation and release gates through `validation:` and `release:` config.
- `bode show <artifact> <KEY> --html` for local HTML artifact rendering.
- `bode init [--overwrite] [--from <file>]` to scaffold `AGENTS.md` with the configured AI CLI.
- `bode learn [--refresh] [--detailed]` to generate `<repo>/.bode/context.md` and inject it into future phase prompts.
- Context warning when `bode start` runs in a repo with no `AGENTS.md` or `README.md`.

### Changed

- `bode skills` now reports the selected skill flavor (`claude`, `openai`, or `neutral`).
- Context precedence now includes `<repo>/.bode/context.md` before hand-authored context files.
- Version bumped to `1.0.0` for the new CLI surface and config schema.

## [0.30.0] — 2026-05-27

Comprehensive testing + architecture maturity pass (GitHub issue #36). Brings bode from "internal-quality" to contributor-safe: 343 tests across unit, integration, and E2E layers; typed error taxonomy; clean tracker abstraction; coverage infrastructure.

### Added

- **c8 coverage** — `npm run test:coverage` reports per-file coverage. `npm run test:all` runs unit + integration + smoke.
- **Error taxonomy** — `src/types/errors.ts` with `BodeError` discriminated union (kinds: config, tracker, phase, adapter, timeout, network, storage, validation). Helpers: `isBodeError`, `bodeErrorToError`, `errorToBodeError`.
- **Unit tests** — 9 new test files covering engine.ts pure helpers, CLI model registry, version utility, branch-manager, config context, config projects, error types. Test count: 217 → 279.
- **Integration tests** — `tests/integration/` with 3 test files: Jira REST adapter against fake HTTP server, CliAdapter spawn against fixture binary, lockfile concurrency under real process forks. Test count: +32.
- **E2E smoke test** — `tests/smoke/full-flow.test.ts` verifying full phase chain (pending→done) through run-meta state machine with lockfile integration.
- **Skill prompt snapshot tests** — 10 regression tests for `buildPrompt` across all phase/context combinations.
- **`resolveConfig()`** — single-entry config resolution in `src/config/loader.ts` consolidating the loadConfig → resolveProject → mergeProjectConfig chain.
- **Test fixtures** — `tests/fixtures/bin/` with `fake-ai-cli.mjs`, `fake-gh.mjs`, `fake-glab.mjs` fixture binaries. `tests/fixtures/jira-responses/` directory for response snapshots.
- **`engine.ts __testing` export** — exposes pure functions (`getExecutingStatus`, `extractSummary`, `formatDuration`) for direct unit testing.

### Changed

- **Tracker naming cleanup** — renamed all internal `jira` variables/parameters to `tracker` or `trackerAdapter` across engine.ts, phase-runner.ts, pr-creator.ts, start.ts, continue.ts, done.ts, summary.ts. `JiraAdapter` type kept as deprecated alias. Error messages now say "Tracker transition" instead of "Jira transition". `RunMeta.jiraSummary` → `RunMeta.trackerSummary`.
- **`CONVENTIONS.md`** — corrected tracker adapter list and error type section to reference `BodeError` discriminated unions.
- **`TESTING.md`** — added coverage workflow, integration test layer, E2E smoke test, `npm run test:all` documentation.
- **`AGENTS.md`** — added `test:coverage` and `test:all` commands, noted c8 dependency, updated key files list.

## [0.29.0] — 2026-05-27

**Drops Node.js 18 support.** Node 18 reached end-of-life in April 2025 and a transitive dependency (`@inquirer/core` via `@inquirer/prompts`) now requires `node:util#styleText`, which only exists in Node 20.12+. CI was red on Node 18 (`TypeError: styleText is not a function` at import time in any test that touches the prompts module); fixing this transparently is not possible without pinning the dependency to an older, unmaintained release.

### Changed

- **`engines.node`** — bumped from `>=18` to `>=20`. `npm install bode` on Node 18 will now refuse instead of installing and failing at runtime.
- **esbuild target** — `node18` → `node20` so the bundle can use Node 20 built-ins directly.
- **CI matrix** — `[18, 20, 22, 24]` → `[20, 22, 24]`. Node 18 job was the only red square.
- **`bode doctor`** — Node version check now requires `>=20` (was `>=18`).
- **Docs** — `AGENTS.md`, `CLAUDE.md`, `SPEC.md` updated to reflect the new minimum.

### Notes

Users still on Node 18: upgrade to Node 20 LTS (or 22 LTS). Both are supported through 2026 and beyond.

## [0.28.2] — 2026-05-27

CI fix + full documentation pass to match the Wave 5 surface.

### Fixed

- **CI test runner** — `npm test` previously used `tsx --test "tests/unit/**/*.test.ts"`, which fails on Node 18 / 20 because `node --test` only gained glob support in Node 21. Replaced with `scripts/test.mjs`, a cross-platform runner that walks `tests/unit/` and hands the resolved list to `tsx --test`. CI was red on all four Node versions in the matrix; now passes everywhere.

### Changed

- **ROADMAP.md** — full rewrite. Waves 0–5 were functionally closed during v0.20–0.28 but the roadmap still described them as upcoming. New plan documents Waves 6 (launch readiness), 7 (adoption flywheel), 8 (daily-driver depth), and 9 (platform, hard-gated). Old waves moved to an Appendix.
- **README.md** — full rewrite. Header version went from 0.10.1 (long stale) to 0.28.2. Added: fast path (`bode <prompt>`), no-args resume, `bode new`, `bode doctor`, `bode compare`, `bode telemetry`, `bode setup-transitions`, hooks YAML, multi-tracker examples (Jira / GitHub Issues / Linear / Notion / Trello / local), `--dangerously-approve-all` and `--dangerously-auto-merge` flags, SEA binary install path. Removed claim that Jira is required.
- **SPEC.md** — full rewrite to match the v0.28 surface. Updated command and flag tables; added Strategy Architecture, Hooks, Telemetry, and Multi-tracker sections; refreshed the Definition of Done; cleaned up Out of Scope.
- **CONVENTIONS.md** — corrected adapter list (removed fictional `zai` adapter, added `src/adapters/tracker/`).
- **AGENTS.md** — corrected stale Jira-mock language (real REST adapter has existed since v0.11.0) and broadened "forbidden direct API call" rule to cover all five tracker providers.

### Added

- **docs/guide/** — `first-run.md`, `configuration.md`, `phases.md`, `with-jira.md`, `with-github-issues.md`, `with-linear.md`, `local-only.md`.
- **docs/reference/** — `cli.md`, `config.md`, `skills.md`, `artifacts.md`.
- **docs/trackers/** — `jira.md`, `github-issues.md`, `linear.md`, `notion.md`, `trello.md`, `local.md`.

All 16 pages referenced by the VitePress sidebar were stubs before this release; the docs site now has every command and every tracker documented with examples.

### Notes

Docs-only release plus the CI fix. No engine changes.

## [0.28.1] — 2026-05-27

**Closes #30 — interactive transition picker.** Last open work item besides #36 (Wave 6, gated).

### Added

- `bode setup-transitions` — fetches available transitions from the active tracker, asks interactively which to use for each bode phase event (`planning`, `implementation`, `review`, `awaiting_merge`, `done`), saves to `.bode.yml`.
- Each phase can be set to `(skip)` — no tracker move at that event.

Roadmap status: zero open issues except #36 (gated). Waves 0-5 functionally complete.

## [0.28.0] — 2026-05-27

Closes Wave 4 + the doable parts of Wave 5. After this, only items that need human/external action remain open (publish to npm, demo video, launch post, GitHub App, skill marketplace).

### Added — docs site scaffold (#22)

- VitePress structure at `docs/`. Config in `docs/.vitepress/config.mts`.
- Home page + getting-started + trackers overview written out. Other pages stubbed by the sidebar config.
- Build with `npx vitepress build docs` (no commitment to add the dep yet — opt-in for whoever maintains the docs site).

### Added — release SEA workflow (#18 follow-up)

- `.github/workflows/release-sea.yml` — on `v*` tag, builds standalone binaries on linux/darwin-x64/darwin-arm64/win32 runners using `scripts/build-sea.mjs`, uploads to GitHub Releases.
- Homebrew tap and scoop manifest auto-bump are a follow-up; for now the formula templates ship with `REPLACE_ME_ON_RELEASE` placeholders for hashes.

### Added — plugin hooks (#27)

- `src/orchestrator/hooks.ts` — `HookPoint = pre_planning | post_planning | ... | pre_pr | post_pr`.
- Configure in YAML:
  ```yaml
  hooks:
    pre_implementation:
      - npm run lint:fix
    post_review:
      - run: ./.bode/hooks/notify.sh
        non_blocking: true
  ```
- Each command runs in the project workdir with env vars: `BODE_TASK_KEY`, `BODE_PHASE`, `BODE_HOOK`, `BODE_WORKDIR`.
- Non-zero exit aborts the phase unless `non_blocking: true`.
- Engine invokes `pre_<phase>` before transition + AI invocation; `post_<phase>` after the artifact lands.

### Added — agent comparison mode (#26)

- `bode compare <taskKey> --agents claude-code,codex` runs the planning phase headless against multiple agents, writes individual artifacts + a summary to `~/.bode/comparisons/<task>-<timestamp>/`.
- Per-agent model override: `--agents claude-code:claude-opus-4-7,codex:gpt-5.5`.
- Planning phase only. Full-flow comparison is Wave 6.

### Tests

- `tests/unit/orchestrator/hooks.test.ts` (4): resolveHooks ordering + entry shapes.

Total: 213 → 217.

### Status of remaining issues

The roadmap is now functionally closed except for items that require human/external action or are explicitly gated:

- **#21 publish to npm** — needs an npm account + 2FA token. Workflow + `files:` whitelist already in place since v0.11.0.
- **#23 demo video** — script writing + recording. Outside what bode the CLI can build.
- **#24 launch post** — same. When ready, hit HN/X/dev.to.
- **#25 skill marketplace** — needs centralized infrastructure. Gated to Wave 5.
- **#28 GitHub App** — server-side infrastructure. Gated to Wave 5.
- **#36 Wave 6 maturity** — explicit gate, post-Wave-4 with real adoption.

These are being closed with notes pointing here. None block daily use.

## [0.27.0] — 2026-05-27

Wave 3 — DX polish. Closes #17, #18, #19, #20.

### Added

- **`src/utils/errors.ts`** (#17): `errorWithHint`, `errorChecklist`, `missingConfigError`, `unknownAdapterError`. Applied to CLI registry.
- **`scripts/build-sea.mjs`** (#18): single-executable binary builder using Node 20+ SEA. No third-party packager. Output: `dist/bode-<platform>-<arch>(.exe)`. ~85MB.
- **`packaging/homebrew/bode.rb`** + **`packaging/scoop/bode.json`** (#19) — formula + manifest templates that pull from GitHub Releases.
- **Opt-in telemetry** (#20): `bode telemetry [on|off|status|preview]`. Default OFF. Records command, success, duration, tracker kind, CLI adapter, versions, machine UUID. NEVER records task content, ticket IDs, code, paths, credentials. Storage `~/.bode/telemetry/events.ndjson`; no network unless user configures `telemetry.endpoint`.

### Tests

- `tests/unit/utils/errors.test.ts` (4), `tests/unit/utils/telemetry.test.ts` (6). Total: 203 → 213.

### Notes

- Wave 3 closed. Cross-platform binary CI for releases is a Wave 4 task.

## [0.26.0] — 2026-05-27

**Wave 2 essentially closed** — three new tracker adapters land (#12, #14, #15) plus `plain-markdown` aliasing (#13) and the long-promised `bode new` command. Zero new dependencies — every external API client is a thin `fetch()` wrapper.

### Added — Linear (#12)

- **`LinearAdapter`** at `src/adapters/tracker/linear.ts`. Uses Linear's GraphQL API directly.
- Auth: `LINEAR_API_KEY` env var (preferred) or `linear.api_key` in config.
- Task keys: Linear identifier form, e.g. `ENG-123`.
- Status: workflow state name (`setStatus("In Progress")` resolves the team's state by name).
- Tags: Linear labels (must exist on the team — adapter does NOT auto-create).
- Comments: `commentCreate` mutation.

### Added — Notion (#14)

- **`NotionAdapter`** at `src/adapters/tracker/notion.ts`. REST + bearer token + `Notion-Version` header.
- Auth: `NOTION_TOKEN` env var or `notion.api_token`.
- Database: `NOTION_DATABASE_ID` or `notion.database_id` (required).
- Property names default to `Name` / `Status` / `Tags`; override via `notion.properties: { title, status, tags }`.
- Comments via the official Notion comments API.
- Status supports both `status` and `select` property types.

### Added — Trello (#15)

- **`TrelloAdapter`** at `src/adapters/tracker/trello.ts`. Key+token query-string auth.
- Auth: `TRELLO_KEY` + `TRELLO_TOKEN` env vars or `trello.api_key` + `trello.token`.
- Task keys: card id (24-char) or short link (8-char from card URL).
- Status: card moves between lists named like the status (`setStatus("In Progress")` finds the "In Progress" list on the card's board).
- Tags: board labels. Auto-creates the label on the board if missing when `addTag` is called.
- Comments via `/cards/{id}/actions/comments`.

### Added — plain-markdown alias (#13)

- `tracker: plain-markdown` in config is an alias for `tracker: local`. Same `LocalTrackerAdapter` backend; the alias makes the format explicit.
- **New `bode new "<summary>"` command** — creates a local task at `<workdir>/.bode/tasks/<auto-key>.md` and prints the key, without running the AI. Pair it with `bode <key>` later to actually do the work.

### Changed

- `tracker` enum now accepts: `jira` | `github-issues` | `linear` | `notion` | `trello` | `local` | `plain-markdown` | `mock`.
- `selectTracker` learned three new branches and surfaces clear errors when credentials are missing (e.g. `"Linear tracker selected but no API key found. Set linear.api_key in config or LINEAR_API_KEY env var."`).
- `start.ts` / `continue.ts` propagate the new `linear` / `notion` / `trello` config blocks to `selectTracker`.

### Tests

- `tests/unit/adapters/tracker/linear.test.ts` (5 cases): construct + interface conformance, no-op success on empty inputs.
- `tests/unit/adapters/tracker/notion.test.ts` (10 cases): property extractor helpers, constructor with/without overrides.
- `tests/unit/adapters/tracker/trello.test.ts` (5 cases): construct + interface conformance.
- `tests/unit/adapters/tracker/factory.test.ts` (8 new cases): credential errors + env-var resolution per adapter.

Total: 176 → 203 (+27).

### Notes

- HTTP calls in Linear/Notion/Trello adapters are not integration-tested (no live API in CI). The contract conformance is tested; real network behavior will be covered under Wave 6.
- All three external adapters implement both canonical (v0.25.0) and deprecated method names.
- `attachFile` is a no-op on all three external adapters (they have their own attachment models that don't map cleanly to file uploads).
- Wave 2 is closed. Wave 3 (DX polish) is next.

## [0.25.0] — 2026-05-27

**Closes #16 — provider-neutral method names on IssueTrackerStrategy.** The Jira-flavored vocabulary (`getIssue`, `addComment`, `transitionStatus`, `addLabel`, `removeLabel`, `getTransitions`) was awkward as soon as LocalTracker and GitHubIssues landed. New canonical names are in. Old names stay until v0.30.0 as `@deprecated` delegates.

### Rename map

| Old (deprecated)   | New (canonical)            |
| ------------------ | -------------------------- |
| `getIssue`         | `fetchTask`                |
| `addComment`       | `postComment`              |
| `transitionStatus` | `setStatus`                |
| `addLabel`         | `addTag`                   |
| `removeLabel`      | `removeTag`                |
| `getTransitions`   | `listStatuses`             |
| `attachFile`       | `attachFile` _(unchanged)_ |

### Changed

- `IssueTrackerStrategy` interface now has 13 methods: 7 canonical + 6 deprecated aliases. Old names still required on the interface for the deprecation window so existing adapter implementations don't break.
- Every adapter (`RealJiraAdapter`, `MockJiraAdapter`, `LocalTrackerAdapter`, `GitHubIssuesAdapter`) implements both name families. Old methods carry the actual logic; new names are one-line delegates. Cheap.
- Internal callers (`engine.ts`, `phase-runner.ts`, `start.ts`, `done.ts`, `continue.ts`) migrated to the canonical names exclusively.
- `JiraAdapter` in `src/types/jira.ts` is now a type alias for `IssueTrackerStrategy`. The old standalone interface is gone. Anyone importing `JiraAdapter` by path still works.

### Deprecation timeline

- v0.25.0 — both name families work. New code SHOULD use the canonical names.
- v0.26.0 → v0.29.x — old names continue working with `@deprecated` JSDoc.
- v0.30.0 — old names removed from the interface. Adapter implementations may drop them at that point.

### Tests

- `tests/unit/adapters/tracker/method-aliases.test.ts` (6 cases): asserts old + new names produce identical outputs across `LocalTrackerAdapter` and `MockJiraAdapter`.

Total: 170 → 176 (+6).

### Migration notes for adapter authors

If you implement `IssueTrackerStrategy` (you have a custom adapter):

- Update to provide both old and new methods through v0.29.x.
- Easiest pattern: keep the old methods as your logic, add 1-line aliases. See `MockJiraAdapter` for the canonical example.
- In v0.30.0 you can drop the old methods entirely.

## [0.24.0] — 2026-05-27

**Closes #11 — GitHub Issues tracker.** First Wave 2 ship; pays off the strategy formalization from v0.17.0. Devs without Jira but using GitHub Issues now get the same end-to-end flow.

### Added

- **`GitHubIssuesAdapter`** at `src/adapters/tracker/github-issues.ts`. Implements `IssueTrackerStrategy`, shells to the user's existing `gh` CLI (no new deps, no new auth). Supports key forms `123`, `#123`, `owner/repo#123`.
- **Explicit `tracker:` config key**. Both global (`~/.bode/config.yml`) and per-project (`.bode.yml`) can set `tracker: jira | github-issues | local | mock`. Honored over auto-selection.
- Selector priority updated:
  1. `force` (test override)
  2. `tracker` from config (explicit choice)
  3. Jira when fully configured
  4. Local fallback
- Phase ↔ GitHub Issue state mapping:
  - planning / implementing / reviewing / awaiting-merge → open + `bode:<phase>` label
  - done → CLOSED via `gh issue close`

### Usage

```yaml
# ~/.bode/config.yml or .bode.yml
tracker: github-issues
```

```bash
bode 312                    # ticket from current repo
bode acme/widgets#7         # ticket from a specific repo
bode "fix the bug"          # freeform → still uses local (no GH issue created)
```

### Tests

- `tests/unit/adapters/tracker/github-issues.test.ts` (10 cases): key parsing across forms, `inferIssueType` from labels, fixed transitions, no-op `attachFile`/`transitionStatus` for non-done.
- Updated `tests/unit/adapters/tracker/factory.test.ts` for explicit `tracker:` honoring (3 new cases).

Total: 157 → 170 (+13).

### Notes

- GitHub Issues has no formal workflow states like Jira, so bode phases are encoded as labels (`bode:planning`, `bode:implementing`, etc.). The engine's existing label add/remove already handles this — no behavior change for users.
- `bode <prompt>` (freeform) still creates a local task; it does NOT auto-open a GitHub issue. To open a GH issue and then run bode against it: `gh issue create -t "..." -b "..."` then `bode 123`.
- Next in Wave 2: #12 Linear (needs `@linear/sdk`, will ask before adding).

## [0.23.0] — 2026-05-27

**Closes #7 — zero-config first run.** Wave 1 is now complete. Bode works on a fresh install with NO `bode setup`, NO `bode setup-project`, NO `~/.bode/config.yml`, NO `.bode.yml`. Just install the CLI, install one AI CLI (claude / codex / opencode), `cd` into any git repo, and:

```bash
bode "fix the dashboard bug"
```

### How it works

When `~/.bode/config.yml` is absent, `loadConfig` synthesizes a complete `BodeConfig` from `detectEnv(cwd)`:

- AI CLI: first of `claude`, `codex`, `opencode` found on PATH.
- Model: sane default for the detected CLI (`claude-opus-4-7`, `gpt-5.5`, `claude-sonnet-4-6`).
- Timeouts: 15min planning, 60min implementation, 10min review.
- VCS provider: inferred from `git remote get-url origin`.
- Jira: empty (falls back to `LocalTrackerAdapter` per v0.21.0).

When no project is configured anywhere (no `.bode.yml` in cwd or ancestors, no entries in `~/.bode/projects/`), `resolveProject` synthesizes a minimal `{ name: 'auto', workdir: cwd, default_branch: 'main' }`.

A `bode setup` user gets a richer config but is no longer required for the basic flow.

### Added

- `buildSyntheticConfig(workdir)` in `src/config/loader.ts`.
- `isAutoDetectedConfig(config)` helper (used today by tests, future use by `bode doctor`).
- Synthetic project fallback in `resolveProject`.
- `tests/unit/config/synthetic.test.ts` (5 cases).

### Notes

- The error path "No project found" only fires now when `--project <name>` is explicitly passed but the named project doesn't exist. Implicit invocations always get a working synthetic project.
- `bode doctor` continues to flag missing global config / context files as warnings — useful signal even when synthetic config works.

## [0.22.0] — 2026-05-27

**Closes #6 — `bode <query>` fast path.** Headline UX: single positional argument, intelligent routing.

### Added

- **`bode <ticket-key>`** (matches `[A-Z]+-\d+`) → runs `bode start` on that key.
- **`bode "<freeform prompt>"`** → creates a local task at `<workdir>/.bode/tasks/auto-<YYYYMMDD-HHMM>-<slug>.md` and starts the regular flow. No Jira required.
- `--project`, `--auto`, `--dangerously-auto-merge`, `--dangerously-approve-all` work on the fast path too.

### Examples

```bash
bode KD-312                                    # ticket flow
bode "fix the dashboard ID/name bug"           # freeform; creates local task
bode "add unit tests for merge logic" --auto
```

### Files

- `src/cli/actions/fast.ts` (`fastAction`, `generateKey`, ticket-key regex)
- `src/cli/commands.ts` (default command via `argument('[query...]')`)

### Tests

- `tests/unit/cli/fast.test.ts` — TICKET_KEY_RE valid+invalid, generateKey edge cases.

Total: 145 → 152 (+7).

### Notes

- Freeform path runs all phases (planning → implementation → review → PR). For unattended, add `--auto`. A `--quick` single-phase mode is on the roadmap.
- Full auto-detect of AI CLI when no global config exists (#7 full integration) is still pending — for now `bode <prompt>` needs `bode setup` run once, OR `claude-code`/`opencode` installed (the DEFAULT_CONFIG CLIs).

## [0.21.0] — 2026-05-27

**Closes #9 — Jira is no longer required.** Bode now has a first-class local file-based tracker. New users without Jira (or with Linear / GitHub Issues / nothing) get a working bode experience without configuring credentials.

### Added

- **`LocalTrackerAdapter`** at `src/adapters/tracker/local.ts`. Stores tasks at `<workdir>/.bode/tasks/<key>.md` with YAML frontmatter (`summary`, `status`, `type`, `assignee`, `labels`, `created`, `updated`) + a markdown body. Comments append as `## Comment — <ISO timestamp>` sections.
- **`selectTracker({ jira, workdir, force? })`** at `src/adapters/tracker/factory.ts`. Returns `{ kind: 'jira' | 'local' | 'mock', adapter }`. Priority:
  1. `force` (test-only override)
  2. Jira (when site + email + token are all present)
  3. Local (default fallback)
- `bode start` prints `Tracker: local (.bode/tasks/) — no Jira configured` when falling back, so users know what's happening.
- `LocalTrackerAdapter.createTask(key, summary, options)` for the upcoming `bode <prompt>` fast path to create tasks programmatically.

### Changed

- **`jira` config block is now optional** in `bodeConfigSchema`. Old configs with `jira: { site: '', default_project: '' }` continue to work; new configs can omit the block entirely.
- `DEFAULT_CONFIG.jira` is now `{}` (was `{ site: '', default_project: '' }`).
- `start.ts`, `continue.ts`, `done.ts` migrated from `createJiraAdapter(config.jira)` to `selectTracker({ jira: config.jira, workdir })`.

### Deprecated

- `createJiraAdapter` in `src/adapters/jira/factory.ts`. Now a thin shim that delegates to `selectTracker`. Behavior shift: when no Jira creds present, returns `LocalTrackerAdapter` instead of `MockJiraAdapter`. Slated for removal in v0.23.0+.

### Tests

- `tests/unit/adapters/tracker/local.test.ts` (12 cases)
- `tests/unit/adapters/tracker/factory.test.ts` (5 cases)
- Updated `tests/unit/adapters/jira/factory.test.ts` for new fallback.

Total: 129 → 145 (+16).

### Migration notes

- If you have `~/.bode/config.yml` without a `jira:` block, bode now works. Tasks live at `<workdir>/.bode/tasks/<key>.md`.
- To keep using Jira: set `jira.site`, `jira.email`, `jira.api_token` — same as before.
- `.bode/tasks/*.md` files are git-trackable. Check them in for AI history, or gitignore them. Bode does not modify `.gitignore`.

## [0.20.0] — 2026-05-27

First Wave 1 release — starts the path to zero-config-first-run.

### Added

- **`bode doctor`** (#10). Diagnoses the environment: Node version, global config, runs directory, git remote (with auto-detected VCS provider), `.bode.yml` presence, context files (AGENTS.md / CLAUDE.md), each AI CLI (claude / opencode / codex), each VCS CLI (gh / glab), registered CLI adapter names. Prints green/yellow/red per check, exits non-zero on any failure. Useful for new users and bug reports.
- **`.bode.yml` in repo root** (#8). New preferred project config location. `resolveProject` now walks up from CWD looking for `.bode.yml`; if found, it wins over the named-project flow (unless `--project` is passed explicitly). Default `workdir` is the directory containing the file. Repo-local config travels with the repo — no global setup needed for fresh clones.
- **`src/config/auto-detect.ts`** (#7 partial). `detectEnv(workdir)` returns `{ gitRemoteUrl, vcsProvider, repoSlug, availableAiCli, contextFiles, hasRepoConfig, hasGlobalConfig }`. The foundation for future zero-config bootstrap; today consumed only by `bode doctor`, but the building block is in place.

### Notes

- Issue #7 (full auto-detect into start/continue) and #6 (`bode <prompt>` fast path) and #9 (Jira optional) are next — they all build on the new `auto-detect.ts` + `.bode.yml` foundation. Shipping them piecewise so each can be validated independently.
- Issue #36 created for Wave 6 (post-Wave-4 comprehensive testing + architecture overhaul). Gated.

## [0.19.0] — 2026-05-27

Closes Wave 0. Two concurrency-safety improvements that previously could lose data or corrupt state.

### Added

- **Atomic `meta.json` writes** (#3). `writeJson` now writes to `<path>.tmp.<pid>.<ts>` first, then `rename`s atomically over the destination. `rename` is atomic on the same filesystem on every supported platform, so a crash or ctrl-C mid-write leaves either the previous file or the new file — never a half-written corrupt JSON. Falls back to non-atomic write if rename fails (e.g. cross-device), only rethrows when the fallback also fails.
- **Per-task lockfile** (#4). `bode start` and `bode continue` acquire an exclusive lock at `~/.bode/runs/<KEY>/.lock` containing `{pid, host, startedAt, command}`. Two concurrent runs on the same task key are refused with a clear message naming the running pid, host, and command. Stale locks (dead pid, or different host) are reclaimed automatically. Released on normal exit, SIGINT, SIGTERM, and uncaught exception via `process.once('exit'/'SIGINT'/'SIGTERM'/'uncaughtException')`.
- `src/storage/lockfile.ts` — `acquireLock`, `inspectLock`. Pure logic, no global state.
- `src/cli/lock-release.ts` — `registerLockReleaseHandlers` wires signal/exit handlers.

### Tests

- `tests/unit/utils/fs-atomic.test.ts` — 4 cases: basic write, no temp leftovers, replace, 10-rewrite never-corrupt.
- `tests/unit/storage/lockfile.test.ts` — 5 cases: acquire/release/inspect, stale-pid reclaim, foreign-host reclaim, same-pid re-acquire.

Total: 107 → 116 tests.

## [0.18.0] — 2026-05-27

**Architectural shift — closes #35.** Bode no longer shells out to `git` directly. Every git operation (branch create/push/checkout/delete, fetch, conflict check, stash, status, switch-to-base) is now the AI's responsibility, performed inside its interactive session via tool calls during the implementation/PR-creation phases. Consistent with v0.16.0 where the AI took over PR creation.

### Removed

- `src/adapters/vcs/git.ts` — deleted. All `git` shellouts removed.
- `branch-manager.ts`: removed `startBranch`, `branchNameForTask`, `checkForConflicts`, `createPullRequest`, `switchToBase`, `cleanupBranch`, `getCurrentBranchName`. Only `mergePR` remains (it shells to `gh pr merge` / `glab mr merge`, not git).
- `VcsAdapter.detectRemote` — unused; removed from interface and both adapter implementations.
- `bode start`: no longer creates a branch, no longer checks workdir cleanliness, no longer prompts stash/retry/abort. Goes straight to the planning phase.
- `bode abort`: no longer deletes branches. Prints cleanup instructions instead.
- `bode done`: no longer switches to base branch. Prints the suggested `git checkout` command.
- Conflict check before PR is no longer a bode operation. It's part of the AI's PR-creation skill prompt.
- Per-phase summary no longer prints `git diff --shortstat` — the user already saw the diff live in the AI session.

### Added

- **`branch.txt` handoff file** at `~/.bode/runs/<KEY>/branch.txt`. The AI writes the working branch name there at the end of implementation; bode reads it and persists to `meta.json`. Used by `bode status` and `bode abort` cleanup instructions.
- **`<branch-context>` block in the prompt**, phase-aware:
  - Planning → read-only, no branches.
  - Implementation → instructs the AI to `git checkout -b <prefix>/<key> <base>` + `git push -u origin <branch>` BEFORE any code changes, with prefix mapping by issue type (Story→feat, Bug→fix, Task→chore, Improvement→refactor).
  - Review → read-only on existing branch.
- **Conflict-check step prepended to the PR-creation prompt** in `pr-creator.ts`. AI runs `git fetch origin` + `git merge-base --is-ancestor` and aborts the PR if conflicts are detected.

### Trade-offs

- Conflict check moves from instant (bode) to AI-token-spending (prompt). Marginal cost — already in the same AI session.
- Bode loses fast pre-validation of dirty workdir. The AI sees it in its session and is instructed to ask the user before stashing.
- The previously bundled "branch convention" mapping moves from `branchNameForTask` (TypeScript) to `suggestedBranchName` (prompt builder). Same table.

### Files touched

- Deleted: `src/adapters/vcs/git.ts`, `tests/unit/orchestrator/branch-manager.test.ts`.
- Heavily modified: `src/orchestrator/{engine,phase-runner,branch-manager,pr-creator}.ts`, `src/cli/actions/{start,done,abort}.ts`, `src/skills/prompt-builder.ts`, `src/skills/defaults/implementation.md`.
- Lighter touch: `src/cli/summary.ts` (drop diff stat), `src/adapters/vcs/{github,gitlab}.ts` (drop detectRemote + git fallback in error path), `src/types/vcs.ts` (drop detectRemote).

## [0.17.0] — 2026-05-27

Wave 0 hardening pass — addresses 6 of the open hardening issues at once.

### Added

- **`IssueTrackerStrategy` type alias** (#5) — provider-neutral name for the existing `JiraAdapter` interface; documented contract; future adapters (GitHub Issues, Linear, etc.) will implement the same shape. Lives in `src/types/issue-tracker.ts`. No behavior change.
- **`jira.transitions.awaiting_merge`** (#33) — separate transition for when the PR is opened, distinct from `review` (which now controls the internal AI-review phase only). Default `awaiting_merge` is `"Code Review"`. Defaults for `implementation` and `review` changed to `"In Progress"` so internal phases no longer move the card.
- **Empty-string transition = skip** — set any `jira.transitions.<key>` to `""` to disable that transition entirely.
- **Diff stat in phase summary** (#31) — after each phase, bode runs `git diff --shortstat <base>...HEAD` and prints `Diff: <n> files changed, +X -Y`. When no changes detected, prints a yellow hint suggesting `--dangerously-approve-all` (likely cause of empty diff in `--auto`).
- **Interactive warning on `--auto` without `--dangerously-approve-all`** (#29) — bode now stops and asks for confirmation before running the AI in headless text-only mode, since that combination produces no actual code changes.

### Fixed

- **Exit code gate** (#1) — `phase-runner` now treats a non-zero CLI exit code as a phase failure, regardless of artifact presence. Previously bode marked success purely on artifact file existence, masking AI sandbox refusals.
- **Prompt injection guard** (#2) — Jira ticket fields and prior artifacts are now wrapped in `<untrusted-*>` blocks. A `<untrusted-input-policy>` header tells the AI to treat the content strictly as data, never as instructions that alter bode's contract, bypass approvals, exfiltrate secrets, etc.

### Notes

- This bump does **not** include the bigger "remove all git from bode" change (#35). That ships as v0.18.0.

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
      planning: 'In Progress'
      implementation: 'In Development'
      review: 'QA' # or whatever your team calls it
      done: 'Done'
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

- **`ZaiAdapter` removed.** Investigation showed that Z.AI's `coding-helper` (a.k.a. `chelper`) is **not** an AI coding agent — it's a config wizard that installs/configures _other_ CLIs (claude-code, opencode, crush, factory-droid) to route through Z.AI's GLM models. The `zai-coding` command this adapter shelled out to does not exist.
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
