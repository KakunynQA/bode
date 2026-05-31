# Bode Prompt Ship

Generator block used by `/bode-ship` to build the 4-phase delivery prompt for the **bode** repository. Run standalone when you only want the prompt text (e.g., to paste into an external agent) without execution.

## Purpose

Produce a single end-to-end prompt that chains the full delivery pipeline for a bode task: plan → review-plan → execute → review → ship. Use this when you want one agent to take a task from description to merged PR (or a green local commit) without manual hand-offs between phases.

## Context

You are working in the **bode** repository (`D:\projects\bode`):

- Single TypeScript repo (strict), Node.js >= 20, CJS bundle at `dist/index.js` via esbuild.
- Adapter boundaries: `src/adapters/{cli,vcs,jira,tracker}/` — never call those backends from outside.
- Validation chain: `npm run check; npm run lint; npm run format:check; npm test; npm run build`.
- Release Discipline (AGENTS.md): every user-facing change ships as a release — version bump + CHANGELOG + dist rebuild + docs update.
- CI: `.github/workflows/ci.yml` (Node 20/22/24).

Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`, `TESTING.md` for the full picture.

## Task

The user's task is: $ARGUMENTS

## Required Questions

Before writing the final prompt, ask only the missing questions from this list. If the user already answered one in `$ARGUMENTS`, skip it.

1. Branch strategy:
   - Create a new branch (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `perf/`)
   - Keep the current branch
   - Work directly on `main` (mark as risky)
2. Should the agent run the Release Discipline gate? (default yes; answer `no` only for in-progress drafts)
3. Should the agent run the global-install smoke test (`npm pack && npm i -g bode-*.tgz && bode --version`) after build?
4. Should the agent open a PR when all gates pass?
5. Should the agent generate an HTML visualization of the plan in `.local/docs`?
6. Process watchdog timeout for long-running commands. Default: 30 minutes.
7. Memory log mode. Default is `auto`: mandatory for multi-repo work, HIGH-risk phases, delegation, more than 4 phases, estimated work above 4 hours, or watchdog intervention.
8. Plan-review strictness: `strict` (default for config schema / run-meta / adapter / CLI surface changes) or `pragmatic` (default for single-file fixes and docs-only)?
9. Triviality: `trivial` (docs-only or single-script change — Phase 1.5 reviewer skipped; Phase 3 runs `npm run format:check` on changed files only, skips check/lint/test/build and Release Discipline; Phase 4 ship discipline unchanged) or `standard` (default)?

Group all unanswered questions in a single message.

## Pipeline

The generated prompt must instruct the target agent to execute these phases in sequence, stopping on any failure:

---

### Phase 1 — PLAN

1. Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`, `TESTING.md`, `README.md`.
2. Inspect relevant code before proposing anything (`glob` + `grep`; do not load whole repo).
3. Identify affected files, tests, docs, Release Discipline impact, and risk.
4. Write the plan to `.local/docs/planning/<task-slug>-plan.md`. **Every phase MUST open with a YAML frontmatter block** — see `/bode-prompt-planning §Task YAML Frontmatter` for the canonical contract. That section is the single source of truth; do not re-list fields here.
5. Move the completed plan to `.local/docs/to-implement/<task-slug>-plan.md`.
6. If HTML visualization was requested, also write `.local/docs/to-implement/<task-slug>-plan.html`.
7. **Checkpoint:** summarize the plan and continue automatically — do not wait for user approval unless a HIGH risk is found.

---

### Phase 1.5 — PLAN REVIEW (APM-inspired)

Skip when Question 9 = `trivial`; proceed directly to Phase 2.

Otherwise:

1. Invoke `/bode-prompt-review-plan` against the plan markdown with the chosen strictness.
2. Write verdict to `.local/docs/to-implement/<task-slug>-review.md`.
3. If `CHANGES REQUESTED`: return to Phase 1 with the Findings table.
4. If `APPROVED WITH MINOR CHANGES`: auto-apply patches inline, re-check, continue.
5. If `APPROVED`: continue to Phase 2.

---

### Phase 2 — EXECUTE

1. Move plan (and `*-review.md` sibling) from `.local/docs/to-implement/` to `.local/docs/implementing/`.
2. **Consume each phase's YAML frontmatter as source of truth** — refuse to start when `depends_on` is unmet; touch only files in `files`; run exactly the commands in `validation`; verify every `expected_output` entry; apply the `release` block.
3. Implement exactly what the plan specifies. Do not add unrequested scope.
4. Update docs as required by `release.docs_to_update` (`SPEC.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `TESTING.md`).
5. Bump `package.json` version per `release.bump` and add a matching `## [X.Y.Z] — YYYY-MM-DD` section to `CHANGELOG.md`.
6. Run targeted tests as you go.
7. Run `npm run build` to rebuild `dist/index.js` so the committed bundle matches the new version.
8. Update the plan Markdown with implementation notes and any deviations.
9. Apply `/bode-process-watchdog` to long-running commands that exceed the configured timeout.
10. Use `/bode-prompt-delegate-research` for current external facts and `/bode-prompt-delegate-debug` after 3 failed local debugging attempts, or immediately for systemic/unclear failures.
11. **Memory logs:** in `auto` mode, write one Dynamic-MD memory log per phase when mandatory triggers apply, following `/bode-prompt-execution` §Memory Log Mode.

---

### Phase 3 — REVIEW (validation gate)

If Question 9 = `trivial`: run `npx --yes prettier --check` (or `npm run format:check`) on the changed files only; skip check/lint/test/build and the Release Discipline check. STOP on formatting failure; otherwise continue.

Otherwise — run from the repo root, in order:

```bash
npm run check
npm run lint
npm run format:check
npm test
npm run build
```

Then verify Release Discipline (unless skipped):

- `package.json` version bumped vs base branch.
- `CHANGELOG.md` has a new dated section matching the version.
- `dist/index.js` was rebuilt (its embedded version matches `package.json`).
- Docs touched as required.

If global-install smoke test was requested:

```bash
npm pack
npm i -g bode-*.tgz
bode --version    # must print the bumped version
```

**If any gate fails:** stop, do NOT commit or push, list failures with fix recommendations, wait for user.

**If all gates pass:** continue to Phase 4.

---

### Phase 4 — SHIP

1. Stage only task-related files (explicit by name — never `git add .` blindly). Do not stage anything under `.local/docs/`.
2. Commit with a conventional message: `type(scope): subject`.
3. Push the branch (unless the user said local-commit-only).
4. If PR was requested: open a PR with body following AGENTS.md (Definition of Done checklist, what / why / how to test).
5. Monitor CI with `gh pr checks <pr-number>` every 60 s until all checks pass.
6. Resolve actionable review comments; dismiss false positives with a one-sentence rationale.
7. Move every `<task-slug>*.{md,html}` file under `.local/docs/implementing/` to `.local/docs/done/` — covers the plan, the HTML sibling, the review verdict, every phase memory log, and any debug-session document produced via delegation.
8. Deliver: commit SHA (+ PR link if opened), CI status, list of files changed, new version + CHANGELOG entry, smoke-test result.

---

## Output Shape

Return a copy-paste-ready prompt in English using this structure:

```
Context
<bode repo + task context>

Goal
<end-to-end delivery objective>

Repository workflow
<bode instruction files, adapter boundaries, Release Discipline>

User delivery preferences
- Branch strategy: <choice>
- Run Release Discipline gate: <yes/no>
- Run global-install smoke test: <yes/no>
- Open PR when gates pass: <yes/no>
- Generate HTML plan: <yes/no>
- Process watchdog timeout: <minutes>
- Memory log mode: <auto | forced-on | optional>
- Plan-review strictness: <strict/pragmatic>
- Triviality: <trivial/standard>

Phase 1 — Plan
<what to inspect and decide, artifact paths, mandatory YAML frontmatter per phase>

Phase 1.5 — Plan Review
<invoke /bode-prompt-review-plan, block on CHANGES REQUESTED>

Phase 2 — Execute
<what to implement, consume phase YAML, Release Discipline, docs, watchdog, delegation, memory logs>

Phase 3 — Review
<validation chain + Release Discipline + optional smoke test, stop condition>

Phase 4 — Ship
<commit, push, PR, CI monitoring, artifact cleanup>

Constraints
<adapter boundaries, no --no-verify, no @ts-ignore, no .github/workflows changes without approval, no new deps without approval, no committing .local/docs>
```

## Local Plan Artifact Workflow

```
.local/docs/planning/       → active plan being drafted (Phase 1)
.local/docs/to-implement/   → completed plan ready to execute (Phase 1 output)
.local/docs/implementing/   → plan being executed (Phase 2)
.local/docs/done/           → completed task record (Phase 4 output)
```

Do not commit `.local/docs` artifacts unless the user explicitly requests it.

## Quality Bar

The generated prompt must drive the agent through all five phases (1, 1.5, 2, 3, 4) without stopping unless the plan reviewer requests changes or a hard failure occurs in the review gate. The agent must not skip phases, must not push on a failed gate, must not consider the task done until the local commit / PR has been delivered with a matching version bump, CHANGELOG entry, and rebuilt `dist/index.js`.
