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
3. **Execute Phases 1–4 inline** in this session, stopping only on a Phase 3 gate failure or HIGH risk in Phase 1.

## Input

`$ARGUMENTS` may be:

- A free-form task description → start at Phase 1 (Plan).
- A path to an existing plan markdown under `.local/docs/` (`planning/`, `to-implement/`, or `implementing/`) → skip ahead: read the plan, validate state, and continue from the appropriate phase.
- Empty → ask the user for the task description.

## Required Questions

Ask only the unanswered ones, grouped in a single message. Skip any already covered by `$ARGUMENTS` or by the conversation history.

1. **Branch strategy:** new branch (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `perf/`), keep current branch, or work on `main` (flag as risky).
2. **Skip Release Discipline gate** in Phase 3? (only sensible for in-progress drafts; default no)
3. **Run global-install smoke test** in Phase 3 (`npm pack && npm i -g bode-*.tgz && bode --version`)? (default yes when behaviour or version changes)
4. **Open a PR** when gates pass? (default yes; otherwise stop at local commit)
5. **Generate an HTML visualization** of the plan in `.local/docs/`? (default no)
6. **Memory log mode** for execution? (one Dynamic-MD memory log per phase under `.local/docs/implementing/` — recommended for tasks > 4 phases or > 4h estimated; default off)
7. **Plan-review strictness**: `strict` (block on any missing section — default for config schema / run-meta / adapter / CLI surface changes) or `pragmatic` (block only on missing tests / Release Discipline / risk — default for single-file fixes and docs-only).

## Pre-flight

Before Phase 1:

- Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md` (relevant sections), `README.md`, `TESTING.md` if not already read this session.
- Run `git status` and note any unrelated working-tree changes — do not touch them.
- Confirm the current branch matches the chosen strategy. Switch or create as needed.
- If `$ARGUMENTS` points to an existing plan, read it end to end and decide which phase to enter.

---

## Phase 1 — Plan

1. Inspect the affected code paths before proposing anything (use `glob` + `grep`; do not load whole repo).
2. Identify: files to touch, tests required, docs to update, Release Discipline impact (version bump tier, CHANGELOG section, dist rebuild), risk.
3. Write the plan to `.local/docs/planning/<task-slug>-plan.md`. **Every phase MUST open with a YAML frontmatter block** as defined in `/bode-prompt-planning` §Task YAML Frontmatter (`objective`, `depends_on`, `files`, `parallelization`, `validation`, `expected_output`, `release`, `risk`, optional `reporting.memory_log`).
4. When the plan is complete, move it to `.local/docs/to-implement/<task-slug>-plan.md`.
5. If HTML was requested, write `.local/docs/to-implement/<task-slug>-plan.html` alongside (self-contained, inline CSS).
6. **Checkpoint:** print a one-screen summary of the plan, then continue automatically. Pause only if a HIGH risk is identified — surface it and wait for the user.

`.local/docs/` artifacts must remain uncommitted.

---

## Phase 1.5 — Plan Review (APM-inspired reviewer pass)

Run the plan reviewer **before any code is touched**. This is the structured second look APM provides via `Project_Breakdown_Review_Guide.md` and prevents wasted Phase 2 work.

1. Invoke `/bode-prompt-review-plan` against `.local/docs/to-implement/<task-slug>-plan.md` with the strictness chosen in question 7.
2. Write the verdict to `.local/docs/to-implement/<task-slug>-review.md`.
3. **If verdict is `CHANGES REQUESTED`:** stop. Print the Findings table, return to Phase 1, fix the plan, rerun Phase 1.5.
4. **If verdict is `APPROVED WITH MINOR CHANGES`:** auto-apply patches inline (allowed in this executor since the user already opted into full execution), then continue.
5. **If verdict is `APPROVED`:** continue to Phase 2.

Do not skip this phase even for small plans — the reviewer is cheap and the checklist exists for a reason.

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
9. **If memory log mode is on (question 6 = yes):** write one Dynamic-MD memory log per phase at the path declared in the phase YAML (default `.local/docs/implementing/<task-slug>-phase-<n>-memory.md`). Follow the section structure in `/bode-prompt-execution` §Memory Log Mode (Summary / Details / Output / Issues / Compatibility Concerns / Ad-Hoc Agent Delegation / Important Findings / Next Steps). Write it as the phase progresses, not retroactively.

---

## Phase 3 — Review (validation gate)

Run from the repo root, in order. Each must pass before the next runs.

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

If global-install smoke test was requested (question 3 = yes):

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
8. Move the plan, any HTML sibling, the `*-review.md` from Phase 1.5, and every `*-phase-<n>-memory.md` from Phase 2 (if memory log mode was on) from `.local/docs/implementing/` to `.local/docs/done/`. Files stay uncommitted.
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

## Related skills

- `/bode-prompt-ship` — assembles this command's 4-phase prompt. Run standalone if you want the prompt text without execution.
- `/bode-prompt-planning` — Phase 1 contract (used when only planning is needed). Defines the Task YAML Frontmatter every phase must carry.
- `/bode-prompt-review-plan` — Phase 1.5 contract (plan reviewer pass between Plan and Execute).
- `/bode-prompt-execution` — Phase 2 contract (executing an existing plan). Defines the opt-in Memory Log mode.
- `/bode-prompt-review` — Phase 3 contract (validation chain + Release Discipline gate).
