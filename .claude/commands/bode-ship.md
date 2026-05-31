---
command_name: bode-ship
description: Execute the full delivery pipeline for the bode repo end-to-end — plan → review-plan → execute → review (npm chain + Release Discipline) → commit/push/PR/CI. Builds the phase prompt internally via /bode-prompt-ship, then runs each phase inline.
---

# /bode-ship — Full Delivery Executor (4 phases)

Execute the complete delivery pipeline for the **bode** repository (`D:\projects\bode`) in this same session. Do not stop until the user-chosen end state is reached: either a green local commit or a merged-ready PR with CI green and review comments resolved.

## How this command composes with the generators

This executor **uses `/bode-prompt-ship` internally** to assemble the structured 4-phase prompt before running anything. Each phase below also follows the contract defined by its phase-specific generator:

- Phase 1 structure ← `/bode-prompt-planning`
- Phase 1.5 structure ← `/bode-prompt-review-plan` (plan reviewer pass — APM-inspired)
- Phase 2 structure ← `/bode-prompt-execution`
- Phase 3 structure ← `/bode-prompt-review`
- Phase 4 ship rules ← AGENTS.md (Workflow Rules + Release Discipline + Definition of Done + Forbidden Actions)

If you only want the prompt text (no execution), call `/bode-prompt-ship` directly.

## Workflow on invocation

1. **Bootstrap the prompt:** invoke `/bode-prompt-ship` with `$ARGUMENTS` to produce the structured 4-phase prompt. Treat its output as the spec for the run — every Phase below MUST follow the structure that generator defines.
2. **Ask any unanswered required questions** (see below). Do not proceed until each one has an answer (or a sane default the user accepts).
3. Execute Phases 1–4 inline in this session. **Stopping points** — the only times this command stops before delivery:
   - Phase 1 surfaces a `HIGH` risk → surface it and wait for the user.
   - Phase 1.5 verdict is `CHANGES REQUESTED` → fix the plan, rerun the reviewer.
   - Phase 3 gate fails → list failures, wait for the user.
   - Phase 4 CI fails for more than 30 minutes on the same root cause → escalate with the failure log.

## Input

`$ARGUMENTS` may be:

- A free-form task description → start at Phase 1 (Plan).
- A path to an existing plan markdown under `.local/docs/` (`planning/`, `to-implement/`, or `implementing/`) → skip ahead: read the plan, validate state, and continue from the appropriate phase.
- Empty → ask the user for the task description.

## Required Questions

Ask only the unanswered ones, grouped in a single message. Skip any already covered by `$ARGUMENTS` or by the conversation history.

1. **Branch strategy:** new branch (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `perf/`), keep current branch, or work on `main` (flag as risky).
2. **Run the Release Discipline gate** in Phase 3? (default yes; answer `no` only for in-progress drafts)
3. **Run global-install smoke test** in Phase 3 (`npm pack && npm i -g bode-*.tgz && bode --version`)? (default yes when behaviour or version changes)
4. **Open a PR** when gates pass? (default yes; otherwise stop at local commit)
5. **Generate an HTML visualization** of the plan in `.local/docs/`? (default no)
6. **Process watchdog timeout** for long-running commands? Default: 30 minutes.
7. **Memory log mode** for execution? Default: `auto`, mandatory for multi-repo work, HIGH-risk phases, delegation, more than 4 phases, estimated work above 4 hours, or watchdog intervention.
8. **Plan-review strictness**: `strict` (block on any missing section — default for config schema / run-meta / adapter / CLI surface changes) or `pragmatic` (block only on missing tests / Release Discipline / risk — default for single-file fixes and docs-only).
9. **Triviality**: `trivial` (docs-only or single-script change — Phase 1.5 reviewer skipped; Phase 3 runs `npm run format:check` on changed files only, skips check/lint/test/build and Release Discipline; Phase 4 ship discipline unchanged) or `standard` (default).

## Pre-flight

Before Phase 1:

- Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md` (relevant sections), `README.md`, `TESTING.md` if not already read this session.
- Run `git status` and note any unrelated working-tree changes — do not touch them.
- **Dirty-workdir overlap rule:** if any staged or unstaged change touches a file the plan will write to, STOP and surface those files to the user before continuing. Do not silently overwrite.
- Confirm the current branch matches the chosen strategy. Switch or create as needed.
- If `$ARGUMENTS` points to an existing plan, read it end to end and decide which phase to enter.

---

## Phase 1 — Plan

1. Inspect the affected code paths before proposing anything (use `glob` + `grep`; do not load whole repo).
2. Identify: files to touch, tests required, docs to update, Release Discipline impact (version bump tier, CHANGELOG section, dist rebuild), risk.
3. Write the plan to `.local/docs/planning/<task-slug>-plan.md`. **Every phase MUST open with a YAML frontmatter block** — see `/bode-prompt-planning §Task YAML Frontmatter` for the canonical contract (required fields, optional fields, conditional fields, validation rules). That section is the single source of truth; do not re-list fields inline elsewhere.
4. When the plan is complete, move it to `.local/docs/to-implement/<task-slug>-plan.md`.
5. If HTML was requested, write `.local/docs/to-implement/<task-slug>-plan.html` alongside (self-contained, inline CSS).
6. **Checkpoint:** print a one-screen summary of the plan, then continue automatically. The HIGH-risk pause rule is defined once in `Workflow on invocation` step 3 — do not duplicate it here.

`.local/docs/` artifacts must remain uncommitted.

---

## Phase 1.5 — Plan Review (APM-inspired reviewer pass)

**Skip this phase entirely when Question 9 = `trivial`** and proceed directly to Phase 2. The reviewer cost is not justified for docs-only or single-script changes.

Otherwise, run the plan reviewer **before any code is touched**. This is the structured second look APM provides via `Project_Breakdown_Review_Guide.md` and prevents wasted Phase 2 work.

1. Invoke `/bode-prompt-review-plan` against `.local/docs/to-implement/<task-slug>-plan.md` with the strictness answered in the Required Questions section above.
2. Write the verdict to `.local/docs/to-implement/<task-slug>-review.md`.
3. **If verdict is `CHANGES REQUESTED`:** stop. Print the Findings table, return to Phase 1, fix the plan, rerun Phase 1.5.
4. **If verdict is `APPROVED WITH MINOR CHANGES`:** auto-apply patches inline (allowed in this executor since the user already opted into full execution), then continue.
5. **If verdict is `APPROVED`:** continue to Phase 2.

Do not skip this phase for non-trivial plans, even when they look small — the reviewer is cheap and the checklist exists for a reason. The only sanctioned skip is Question 9 = `trivial`.

---

## Phase 2 — Execute

1. Move the plan from `.local/docs/to-implement/` to `.local/docs/implementing/`. If a `*-review.md` sibling exists, move it too.
2. **Consume the YAML frontmatter of each phase as the source of truth.** For every phase: refuse to start if `depends_on` outputs are missing; only touch files listed in `files`; run exactly the commands in `validation`; verify every `expected_output` entry before moving on; apply the `release` block.
3. Implement exactly what the plan specifies. No unrequested scope, no opportunistic refactors.
4. Update docs only when `release.docs_to_update` says to (`SPEC.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `TESTING.md`).
5. Bump `package.json` per `release.bump` and add a new `## [X.Y.Z] — YYYY-MM-DD` section to `CHANGELOG.md` (Keep a Changelog: `Added` / `Changed` / `Fixed` / `Removed`).
6. Run targeted tests as you go (the specific spec file under `tests/` for the module touched).
7. Run `npm run build` so the committed `dist/index.js` matches the new version.
8. Append an **Implementation notes** section to the plan markdown: actual line numbers, deviations, decisions made.
9. Apply `/bode-process-watchdog` to any command that exceeds the configured threshold. Inspect before killing; document every continue/terminate/ask decision in the plan notes.
10. Use `/bode-prompt-delegate-research` when current external facts are needed and `/bode-prompt-delegate-debug` after 3 failed debugging attempts, or immediately for systemic, CI-only, environment-specific, or unclear failures. Do not make a fourth local fix attempt.
11. **Memory logs:** in `auto` mode, write one Dynamic-MD memory log per phase when mandatory triggers apply: multi-repo, HIGH risk, delegation, more than 4 phases, work above 4 hours, watchdog intervention, or explicit phase `reporting.memory_log`.

---

## Phase 3 — Review (validation gate)

**If Question 9 = `trivial`:** run `npx --yes prettier --check` (or `npm run format:check`) on the changed files only. Skip the rest of the validation chain (`npm run check`, `npm run lint`, `npm test`, `npm run build`) and skip the Release Discipline check entirely. If formatting fails, STOP — do not commit. If formatting passes, continue to Phase 4.

Otherwise — run from the repo root, in order. Each must pass before the next runs.

```bash
npm run check
npm run lint
npm run format:check
npm test
npm run build
```

Then verify Release Discipline (unless skipped):

- `package.json` version was bumped vs the base branch.
- `CHANGELOG.md` has a new dated section that matches that version.
- `dist/index.js` was rebuilt for the new version.
- Required docs were touched.

If the global-install smoke test was requested:

```bash
npm pack
npm i -g bode-*.tgz
bode --version    # must print the bumped version
```

On Windows / npm 11 symlink quirks, fall back to running the packed tarball with `node` and assert the printed version.

**If any gate fails:** STOP. Do not commit. List failures with file/line and a fix recommendation, then wait for the user.

**If all gates pass:** continue to Phase 4.

---

## Phase 4 — Ship

1. `git status` + `git diff` — confirm only task-related files are modified.
2. Stage explicitly by file name. Never `git add .` blindly. Do not stage anything under `.local/docs/`.
3. Commit on the chosen branch with a conventional message:
   `<type>(<scope>): <subject>`
   Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`.
   Never use `--no-verify` or bypass signing. If a hook fails, fix the root cause and create a NEW commit (do not `--amend`).
4. **If the user did NOT request a PR:** stop here. Report the local commit SHA, files changed, validation results, version + CHANGELOG entry, smoke-test result. Skip to step 9 with PR-related items omitted.
5. **If the user requested a PR:** `git push -u origin <branch>`, then `gh pr create` with a body that mirrors the Definition of Done checklist (what / why / how to test, validation table, CHANGELOG entry).
6. Monitor CI every 60 seconds with `gh pr checks <pr-number>`. On failure: fetch log with `gh run view <run-id> --log-failed`, fix root cause, commit, push, restart monitoring.
7. After CI is green, wait 2 minutes, then `gh pr view <pr-number> --comments`. For each comment: apply fix (return to step 6), reply with one-sentence rationale to dismiss false positives, or ask the user when unclear.
8. **Archive plan artifacts:** move every `<task-slug>*.{md,html}` file under `.local/docs/implementing/` to `.local/docs/done/`. This covers the plan, the HTML sibling, the `*-review.md` from Phase 1.5, every `*-phase-<n>-memory.md` from Phase 2, and any `*-debug-session.md` produced via `/bode-prompt-delegate-debug` in Phase 2 step 10. Files stay uncommitted.
9. **Deliver** to the user in one short message:
   - Local commit SHA (and PR URL if opened).
   - Files changed.
   - Validation chain results.
   - New version + CHANGELOG entry text.
   - Smoke-test result (if requested).
   - CI status and comment resolution count (if PR was opened).

---

## Local Plan Artifact Workflow

```
.local/docs/planning/       active plan being drafted (Phase 1)
.local/docs/to-implement/   completed plan ready to execute (Phase 1 output)
.local/docs/implementing/   plan being executed (Phase 2)
.local/docs/done/           completed task record (Phase 4 output)
```

Never commit `.local/docs/` artifacts unless the user explicitly asks.

## Hard Rules

- Task is **not done** until Phase 4 step 9 has been delivered with version + CHANGELOG entry + rebuilt `dist/index.js`.
- Never force-push to `main`.
- Never `--no-verify` or `--no-gpg-sign`.
- Never push or open a PR if any gate failed in Phase 3.
- Never use `// @ts-ignore` or `// eslint-disable` to make Phase 3 pass — fix the root cause.
- Never add a dependency to `package.json` without explicit user approval (AGENTS.md §Forbidden Actions).
- Never change `.github/workflows/` without explicit user approval.
- Never delete a test without explicit user approval.
- Never call tracker APIs (Jira, GitHub Issues, Linear, Notion, Trello) from outside `src/adapters/jira/` or `src/adapters/tracker/`.
- Never call `gh` / `glab` / `git` from outside `src/adapters/vcs/`.
- If CI fails for more than 30 minutes on the same root cause, escalate to the user with the failure log instead of retrying silently.
- If a local process runs longer than the configured watchdog timeout, inspect before killing it. Document the decision in plan notes and in the phase memory log when memory logging is mandatory.

## Related skills

- `/bode-prompt-ship` — assembles this command's 4-phase prompt. Run standalone if you want the prompt text without execution.
- `/bode-prompt-planning` — Phase 1 contract (used when only planning is needed). Defines the Task YAML Frontmatter every phase must carry.
- `/bode-prompt-review-plan` — Phase 1.5 contract (plan reviewer pass between Plan and Execute).
- `/bode-prompt-execution` — Phase 2 contract (executing an existing plan). Defines auto Memory Log mode, delegation, and watchdog behavior.
- `/bode-prompt-review` — Phase 3 contract (validation chain + Release Discipline gate).
- `/bode-process-watchdog` - inspect and optionally terminate long-running commands.
- `/bode-prompt-delegate-research` - create scoped research delegation prompts.
- `/bode-prompt-delegate-debug` - create scoped debug delegation prompts.
