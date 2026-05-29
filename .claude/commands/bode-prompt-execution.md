# Bode Prompt Execution

Generator block for Phase 2 (Execute). Produces a copy-paste prompt that drives another agent through implementation of an existing plan in the **bode** repository. Called by `/bode-ship` when assembling the Execute phase, or used standalone for external delegation.

## Purpose

Produce a prompt that another coding agent can use to implement a task in the bode repo end to end. The prompt must preserve `AGENTS.md` / `CONVENTIONS.md` / `SPEC.md` rules, require docs review, require tests, enforce Release Discipline, encode the user's delivery choices, and move local plan artifacts through the implementation workflow.

## Context

You are working in the **bode** repository (`D:\projects\bode`):

- Single TypeScript repo (strict), Node.js >= 20, CJS bundle in `dist/index.js` via esbuild.
- Adapter boundaries are inviolable — see `src/adapters/{cli,vcs,jira,tracker}/`.
- Orchestrator: `src/orchestrator/`. Config: `src/config/` (Zod schema). Skills: `src/skills/resolver.ts`.
- Tests in `tests/` — `npm test` runs them. Fixtures under `tests/fixtures/`.
- Validation chain (every phase): `npm run check; npm run lint; npm run format:check; npm test; npm run build`.

Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`, `TESTING.md` for full conventions.

## Task

The user's execution request is: $ARGUMENTS

## Required Questions

Before writing the final prompt, ask only the missing questions from this list. If the user already answered one in `$ARGUMENTS`, skip it.

1. Branch strategy:
   - Create a new branch (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `perf/`)
   - Work directly on `main` (mark as risky)
   - Keep the current branch
2. Should the agent commit after the work is complete?
3. Should the agent push?
4. Should the agent open a PR?
5. Should the agent reinstall the built CLI globally (`npm run build && npm pack && npm i -g bode-*.tgz`) and smoke-test it (`bode --version`)?
6. Memory log mode. Default is `auto`: mandatory for multi-repo work, HIGH-risk phases, tasks with delegation, tasks with more than 4 phases, work estimated above 4 hours, or watchdog intervention; otherwise optional.
7. Process watchdog timeout for long-running commands. Default: 30 minutes.

Group all unanswered questions in a single message.

## Execution Prompt Requirements

The generated prompt must instruct the target agent to:

- Read repository instructions first: `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`, `README.md`, `TESTING.md`, plus the plan markdown.
- **Consume the YAML frontmatter of each phase as the source of truth.** Every phase in the plan markdown begins with a YAML block (see `/bode-prompt-planning` §Task YAML Frontmatter) defining `objective`, `depends_on`, `files`, `validation`, `expected_output`, `release`, `risk`, and optional `reporting.memory_log`. The execution agent must:
   - refuse to start a phase whose `depends_on` outputs are not yet produced
   - implement only files listed in `files` (deviations must be appended to the plan's Implementation notes section with a one-line reason)
   - run exactly the commands listed in `validation` for that phase before claiming the phase done
   - confirm every entry in `expected_output` exists before moving to the next phase
   - apply the `release` block (version bump, CHANGELOG entry, dist rebuild, docs update) per AGENTS.md §Release Discipline
- Inspect the current branch, working tree, and relevant files before editing.
- Respect user changes already on the branch — avoid reverting unrelated work.
- Follow `CONVENTIONS.md`, adapter boundaries, naming, and code standards.
- **Never** call tracker REST/GraphQL APIs from outside `src/adapters/jira/` or `src/adapters/tracker/`. **Never** call `gh` / `glab` / `git` from outside `src/adapters/vcs/`.
- Update documentation when behavior, configuration, commands, or workflows change (`SPEC.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `TESTING.md`).
- Run targeted tests first (the spec file for the module touched), then the full chain (`npm run check; npm run lint; npm run format:check; npm test; npm run build`).
- Clearly document any tests that cannot be run and why.
- Apply the user's choices for branch creation, committing, pushing, PR creation, and rebuild-and-smoke-test.
- Apply a process watchdog to every long-running command. Default timeout: 30 minutes. If a command exceeds the threshold, inspect process state, logs, CPU/memory activity, and recent output before deciding whether to continue, terminate, or ask the user. Follow `/bode-process-watchdog`.
- Use `/bode-prompt-delegate-research` for current external documentation, compatibility, migration, API behavior, or practice questions that would pollute the main implementation context.
- Use `/bode-prompt-delegate-debug` after 3 failed debugging attempts, or immediately for systemic, CI-only, environment-specific, or unclear failures. Do not make a fourth local fix attempt.
- Move the implementation plan document through `.local/docs` workflow folders.
- If rebuild-and-smoke-test is requested, run `npm run build && npm pack && npm i -g bode-*.tgz`, then `bode --version` and assert it prints the bumped version.
- Provide final status: changed files, validation results, version + CHANGELOG entry, PR link if created.

## Output Shape

Return a copy-paste-ready prompt in English using this structure:

```
Context
<bode repo + task context>

Goal
<implementation objective>

Repository workflow
<bode instruction files, adapter boundaries, Release Discipline>

User delivery preferences
- Branch strategy: <choice>
- Commit after completion: <yes/no>
- Push after completion: <yes/no>
- Open PR after completion: <yes/no>
- Rebuild + global reinstall + smoke test: <yes/no>
- Memory log mode: <auto | forced-on | optional>
- Process watchdog timeout: <minutes>

Implementation requirements
<what to build/change, consuming YAML frontmatter as source of truth>

Validation requirements
<targeted tests, full chain, build>

Release Discipline requirements
<version bump, CHANGELOG entry, dist rebuild, docs update>

Documentation requirements
<which of SPEC/README/AGENTS/CLAUDE/CONVENTIONS/TESTING to update>

Local plan artifact workflow
<.local/docs/to-implement → implementing → done>

Delivery requirements
<commit message format, push, PR, final response>

Constraints
<adapter boundaries, forbidden actions, no --no-verify, no @ts-ignore>
```

## Local Plan Artifact Workflow

The generated prompt must tell the target agent to use this workflow when a plan artifact exists:

```
.local/docs/to-plan/        incoming ideas or prompts waiting to be planned
.local/docs/planning/       plans currently being researched or drafted
.local/docs/to-implement/   completed plans ready for implementation
.local/docs/implementing/   plans currently being implemented
.local/docs/done/           completed implementation records and final plans
```

For execution prompts, instruct the target agent to:

1. Look for the relevant plan in `.local/docs/to-implement/`.
2. Move the active plan files to `.local/docs/implementing/` before editing code.
3. Keep Markdown and HTML files together when both exist.
4. Update the Markdown plan with implementation notes, validation results, and deviations.
5. After implementation and delivery steps are complete, move task files to `.local/docs/done/`.
6. Leave `.local/docs` files uncommitted unless the user explicitly asks.
7. Mention the final artifact paths in the final response.

If no local plan artifact exists, create a short implementation record in `.local/docs/implementing/<task-slug>-implementation.md` at the start, then move it to `.local/docs/done/` when complete.

## Release Discipline (mandatory)

Every user-facing change ships as a release. The generated prompt must require the target agent to, without being asked:

1. **Bump version** in `package.json` per semver (patch / minor / major — see AGENTS.md §Release Discipline).
2. **Update `CHANGELOG.md`** under a new dated `## [X.Y.Z] — YYYY-MM-DD` section, with `### Added / Changed / Fixed / Removed` subsections.
3. **Update relevant docs** (`SPEC.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `TESTING.md`) in the same commit when behavior / schema / commands / lifecycle / standards / test layout changed.
4. **Rebuild `dist/`** (`npm run build`) so the committed bundle matches the new version.
5. **Verify** by running `bode --version` against the built binary and confirming the new number.

Skipping any of these means the task is not done. The user should not need to ask "did you bump the version?" or "did you update CHANGELOG?".

For pure-internal refactors with no user-visible effect, the plan YAML can declare `release.bump: none` — but the agent must double-check that nothing under `src/` user-facing actually changed before applying that exception.

## Commit Message Format

Conventional commits: `type(scope): subject`.

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`.

Examples (from real bode history):
- `feat(tracker): Linear + Notion + Trello + plain-markdown + bode new`
- `fix(ci): drop Node 18 — @inquirer/core needs util.styleText`
- `refactor(tracker): provider-neutral method names`

## Memory Log Mode

Borrowed from APM's `Memory_Log_Guide.md` (Dynamic-MD strategy). When memory log mode is `auto`, the execution agent MUST write one memory log per phase when any mandatory trigger applies.

Mandatory triggers:

- The task touches more than one repository.
- Any phase has `risk.level: HIGH`.
- The task has more than 4 phases.
- The work is estimated above 4 hours.
- Research or debug delegation is used.
- A watchdog terminates a process or marks a phase blocked.
- The phase YAML frontmatter has a `reporting.memory_log` path.

For small, single-repo, low-risk work with no delegation and no watchdog intervention, memory logs remain optional unless the user explicitly enables them.

**One file per phase**, at the path declared in the phase YAML (default: `.local/docs/implementing/<task-slug>-phase-<n>-memory.md`).

Each memory log uses this Dynamic-MD frontmatter and section structure:

```markdown
---
task: <task-slug>
phase: <n>
title: <phase title>
status: in-progress | completed | blocked
started: <ISO timestamp>
finished: <ISO timestamp | omit>
agent: <model name / session id if available>
---

## Summary
<2–4 sentences: what this phase actually did vs what the plan asked for>

## Details
<step-by-step record of decisions made, files touched, refactors deferred, why a deviation from `files` was needed>

## Output
<concrete artifacts: file paths, commit SHAs, validation command results, version bumped to, CHANGELOG entry>

## Issues
<problems hit, root causes, what unblocked them — even if the phase succeeded>

## Compatibility Concerns
<config schema / run-meta / lockfile / dist bundle format risks, env or config that downstream phases must respect>

## Ad-Hoc Agent Delegation
<which subagents (if any) were spawned, what they returned, links to their output>

## Important Findings
<things future-you / a fresh agent must know — non-obvious, would be lost if not written>

## Next Steps
<exactly what the next phase must do given the state this phase left behind>
```

Rules:

- One memory log per phase. Never aggregate into a single end-of-task log.
- Write it as the phase progresses, not retroactively. Status transitions: `in-progress` -> `completed` or `blocked`.
- Record research/debug delegations and process watchdog decisions in the relevant phase log.
- Memory logs stay under `.local/docs/implementing/` until the whole task is done, then move with the plan to `.local/docs/done/`. Never commit.
- A fresh agent resuming the task must be able to read the plan markdown + all per-phase memory logs and pick up the next phase without re-asking the user.

## Process Watchdog

Every command expected to run for a long time must have a watchdog threshold. Default: 30 minutes.

When a command exceeds the threshold:

1. Inspect before killing: process tree, elapsed time, CPU/memory, recent output, logs, and whether files are still changing.
2. Continue if there is credible progress or the command is an expected long-running process.
3. Terminate only if the command is stuck, safe to restart, and blocking the workflow.
4. Ask the user before terminating migrations, deploys, seed scripts, FTP/SFTP uploads, Docker volume operations, remote-state mutations, or any user-owned process.
5. After termination, record the decision and rerun the narrowest diagnostic command.

Use `/bode-process-watchdog` for the inspection/report format.

## Delegation Protocol

Use scoped delegation to preserve context and avoid local retry loops:

- Research: generate a prompt with `/bode-prompt-delegate-research` when current external facts are needed.
- Debug: generate a prompt with `/bode-prompt-delegate-debug` after 3 failed local attempts or immediately for systemic/unclear failures.
- Integrate returned findings into the active plan notes and phase memory log.

Rules:

- One memory log per phase. Never aggregate into a single end-of-task log.
- Write it as the phase progresses, not retroactively. Status transitions: `in-progress` → `completed` or `blocked`.
- Memory logs stay under `.local/docs/implementing/` until the whole task is done, then move with the plan to `.local/docs/done/`. Never commit.
- A fresh agent resuming the task must be able to read the plan markdown + all per-phase memory logs and pick up the next phase without re-asking the user.

## Forbidden Actions

The generated prompt must remind the target agent that the following require explicit human approval (from AGENTS.md §Forbidden Actions):

- Adding new dependencies to `package.json`.
- Changing files in `.github/workflows/`.
- Deleting tests.
- Disabling lint rules or TypeScript errors via `// @ts-ignore` / `// eslint-disable`.
- Pushing directly to `main` or force-pushing shared branches.
- Calling tracker APIs from outside `src/adapters/jira/` or `src/adapters/tracker/`.
- Calling `gh` / `glab` / `git` from outside `src/adapters/vcs/`.

## Quality Bar

The prompt must drive the target agent to finish implementation, validation, docs review, Release Discipline, and requested delivery steps. Never stop at a proposal when the user asked for execution. A task that ships code without a version bump, CHANGELOG entry, and rebuilt `dist/index.js` is not done.
