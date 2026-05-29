# Bode Prompt Planning

Generator block for Phase 1 (Plan). Produces a copy-paste prompt that drives another agent through plan-only work in the **bode** repository. Called by `/bode-ship` when assembling the Plan phase, or used standalone for external delegation.

## Purpose

Produce a prompt that another coding agent can use to plan work in the bode repo before implementation. The prompt must drive the agent to inspect the repo, follow `AGENTS.md` / `CONVENTIONS.md` / `SPEC.md`, identify docs/tests/release impact, ask the user for delivery preferences, and write the resulting plan to local non-committed artifacts.

## Context

You are working in the **bode** repository (`D:\projects\bode`):

- Single TypeScript repo (strict mode), Node.js >= 20.
- Built with esbuild to a single CJS bundle at `dist/index.js`.
- No DB — filesystem state under `~/.bode/`.
- Adapters: AI CLIs (`src/adapters/cli/`), VCS (`src/adapters/vcs/`), Jira (`src/adapters/jira/`), trackers (`src/adapters/tracker/`).
- Orchestrator: `src/orchestrator/` (phase runner, engine, branch manager, preflight, PR creator).
- Config: YAML at `~/.bode/config.yml`, project `.bode.yml`, project configs `~/.bode/projects/<name>.yml`. Schema in `src/config/schema.ts` (Zod).
- Skills: markdown at `~/.bode/skills/` and project `.bode/skills/`. Resolver: `src/skills/resolver.ts`.
- Tests: `tests/` (run via `npm test`).
- Validation chain: `npm run check; npm run lint; npm run format:check; npm test; npm run build`.

Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md` for the full picture.

## Task

The user's planning request is: $ARGUMENTS

## Required Questions

Before writing the final prompt, ask only the missing questions from this list. If the user already answered one in `$ARGUMENTS`, skip it.

1. Branch strategy:
   - Create a new branch (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `perf/`)
   - Work directly on `main` (mark as risky)
   - Keep the current branch
2. After planning/implementation, should the agent commit?
3. Should the agent push?
4. Should the agent open a PR?
5. After completion, should the agent reinstall the built CLI globally (`npm run build && npm pack && npm i -g bode-*.tgz`) and smoke-test it (`bode --version`)?
6. Should the agent also generate an HTML visualization of the plan in `.local/docs`?

Group all unanswered questions in a single message.

## Planning Prompt Requirements

The generated prompt must instruct the target agent to:

- Read repository instructions first: `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`, `README.md`, `TESTING.md`, `ROADMAP.md` (when relevant), and any nearby module docs.
- Inspect existing code before proposing a plan. Use `glob` + `grep`; do not load the whole repo.
- Preserve code conventions, naming, architecture patterns, and the adapter boundaries (`CliAdapter`, `VcsAdapter`, `IssueTrackerStrategy`, Jira adapter) — never reach into `gh` / `glab` / `git` / tracker REST APIs from outside the corresponding adapter directory.
- Review whether docs need updates (`SPEC.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `TESTING.md`).
- Identify required tests (unit + integration). The bode convention is: no bug fix without a regression test unless impossible — explain why if skipped.
- Identify validation commands (`npm run check`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`).
- Identify Release Discipline impact:
   - Version bump in `package.json` (patch / minor / major per AGENTS.md §Release Discipline).
   - New dated section in `CHANGELOG.md` (Keep a Changelog).
   - Rebuild and commit `dist/index.js`.
   - Verify with `bode --version`.
- Identify migration risk (config schema changes, run-meta format, lockfile format under `~/.bode/runs/<KEY>/`).
- Include branch, commit, push, PR, and rebuild-and-smoke-test preferences from the user's answers.
- Produce a clear plan with phases, files likely touched, validation steps, and risks.
- **Open every phase with a YAML frontmatter block.** See §Task YAML Frontmatter below — every phase MUST start with that block before its prose. This is non-negotiable and is enforced by `/bode-prompt-review-plan`.
- **Identify parallelization opportunities.** For each phase, mark which steps are independent and can be run concurrently (different subagents, different shells, different files) vs which are strictly sequential. Produce an explicit dependency graph and a recommended wave layout. The goal is to minimize wall-clock time without breaking ordering invariants.
- Write the plan to a Markdown file under the local planning workflow folders in `.local/docs`.
- Ensure `.local/docs` planning artifacts are **not committed**. If `.local/` is not gitignored, leave files untracked and warn the user explicitly.
- When the user wants easier visual review, also generate a self-contained HTML version in the same workflow folder.
- **Avoid implementation** unless the user explicitly asks the target agent to continue into execution.

## Output Shape

Return a copy-paste-ready prompt in English using this structure:

```
Context
<bode repo + task context>

Goal
<clear planning objective>

Repository workflow
<bode instruction files to read, adapter boundaries, Release Discipline>

User delivery preferences
- Branch strategy: <choice>
- Commit after completion: <yes/no>
- Push after completion: <yes/no>
- Open PR after completion: <yes/no>
- Rebuild + global reinstall + smoke test: <yes/no>
- Generate HTML plan visualization: <yes/no>

Planning requirements
<what the agent must inspect and decide>

Parallelization
<for each phase, list steps that can run concurrently (with the subagent / shell that runs each), the strict-sequential steps, and the resulting wave layout that minimizes wall-clock time>

Task YAML frontmatter
<every phase in the plan markdown MUST begin with a YAML frontmatter block (see §Task YAML Frontmatter) — objective, depends_on, files, validation, expected_output, etc.>

Release Discipline
<version bump tier, CHANGELOG section, docs to update, dist rebuild>

Expected output
<plan files and final summary the target agent should produce>

Constraints
<conventions, adapter boundaries, forbidden actions, docs, tests, risk notes>
```

## Plan Artifacts

The generated prompt must tell the target agent to use this local document workflow:

```
.local/docs/to-plan/        incoming ideas or prompts waiting to be planned
.local/docs/planning/       plans currently being researched or drafted
.local/docs/to-implement/   completed plans ready for implementation
.local/docs/implementing/   plans currently being implemented
.local/docs/done/           completed implementation records and final plans
```

For planning prompts, instruct the target agent to:

1. Create `.local/docs/to-plan/` and `.local/docs/planning/` if missing.
2. Move or create the active planning artifact in `.local/docs/planning/<task-slug>-plan.md`.
3. Write the completed plan to `.local/docs/to-implement/<task-slug>-plan.md`.
4. If HTML visualization is requested, write it beside the completed plan as `.local/docs/to-implement/<task-slug>-plan.html`.
5. Leave `.local/docs/planning/` clean for that task after the plan is complete.

The Markdown plan is the source artifact. The HTML plan is for visual review only — self-contained with inline CSS, no external dependencies.

The HTML version should make the plan easier to scan:
- Title and short objective
- Status/decision summary
- Phase cards or sections
- File impact table
- Validation checklist (incl. Release Discipline checklist)
- **Parallelization map** — wave layout / dependency graph showing which steps fan out concurrently and which gate the next wave
- Risks/open questions section

Do not commit `.local/docs` artifacts unless the user explicitly changes that requirement.

## Parallelization Guidance

The generated prompt must require the target agent to identify and label parallel opportunities, not just list serial steps. Specifically:

- Distinguish steps that touch independent files / modules / processes from those with a real dependency (e.g., schema change in `src/config/schema.ts` → loader/test updates that consume it; new adapter file → registry registration that imports it).
- For each phase, output a wave layout like:
  - **Wave 1 (parallel):** step A, step B, step D
  - **Gate:** wait for all of wave 1 to finish
  - **Wave 2 (sequential):** step C (consumes A's output)
  - **Wave 3 (parallel):** step E, step F
- Recommend the execution mechanism per parallel branch: subagent (isolated context), background shell, separate Read calls in one tool batch.
- Call out anti-parallel constraints explicitly. Bode-specific examples:
   - `package.json` version bump → `npm run build` (build embeds version) → commit (dist must match version).
   - Config schema change → loader test updates that depend on the new schema.
   - Adapter file added → registry registration → setup wizard auto-discovery test.
   - Skill prompt change → fixture regeneration → renderer test.
- Estimate the wall-clock savings vs the naive serial run.

If a phase is genuinely all-or-nothing serial, say so explicitly — don't fabricate parallelism.

## Task YAML Frontmatter

Borrowed from APM's `Task_Assignment_Guide.md`. Every phase in the plan markdown MUST open with a YAML frontmatter block before its prose. This gives the execution agent (and the plan reviewer) explicit, machine-readable exit criteria per phase.

Each phase header looks like this:

````markdown
## Phase <n> — <short title>

```yaml
task: <task-slug>
phase: <n>
title: <short title>
objective: |
  <one paragraph: what this phase delivers and why>
depends_on:
  - phase: <m>
    output: <named output of phase m>
  - external: <e.g., upstream PR merged>
files:
  - <src/path/to/file.ts>
  - <tests/path/to/spec.test.ts>
  - <SPEC.md | README.md | AGENTS.md | CHANGELOG.md | package.json>
parallelization:
  wave_1_parallel:
    - <step A>
    - <step B>
  gate: <description of what must finish before wave 2>
  wave_2_sequential:
    - <step C>
  anti_parallel:
    - <reason — e.g., version bump → build → commit>
validation:
  - <npm run check>
  - <npm run lint>
  - <npm test -- tests/path/spec.test.ts>
  - <npm run build>
expected_output:
  - <artifact / behaviour / file>
release:
  bump: <patch | minor | major | none>
  changelog_section: <Added | Changed | Fixed | Removed | none>
  rebuild_dist: <yes | no>
  docs_to_update:
    - <SPEC.md | README.md | AGENTS.md | CLAUDE.md | CONVENTIONS.md | TESTING.md | none>
risk:
  level: <LOW | MED | HIGH>
  notes: <one line per risk>
  mitigation: <required when level is HIGH>
reporting:
  memory_log: <.local/docs/implementing/<task-slug>-phase-<n>-memory.md | omit>
```

<phase prose follows: design notes, code excerpts, edge cases>
````

Rules:

- The YAML block is **mandatory** for every phase, including small ones. If a field doesn't apply, set it to `none` or omit it — but `objective`, `files`, `validation`, `expected_output`, `release`, and `risk` are required.
- `depends_on` is what makes wave parallelization safe — leaving it empty when a real dependency exists is a BLOCK finding in plan review.
- `release.bump` is required because every user-facing change in bode must ship as a release (see AGENTS.md §Release Discipline). Set to `none` only for pure-internal refactors with no user-visible effect.
- `reporting.memory_log` is optional and only present when the user enabled memory logs at `/bode-ship` time. Default: omit.
- The YAML must be valid (no trailing commas, no smart quotes). If the planner needs free-form text, use the prose block under the YAML, not inside it.

## Forbidden Actions to Surface in the Plan

The plan must explicitly flag — and refuse to proceed without user approval on — any of these (from AGENTS.md §Forbidden Actions):

- Adding new dependencies to `package.json`.
- Changing files in `.github/workflows/`.
- Deleting tests.
- Disabling lint rules or TypeScript errors via `// @ts-ignore` / `// eslint-disable`.
- Pushing directly to `main` or force-pushing shared branches.
- Calling tracker APIs (Jira, GitHub Issues, Linear, Notion, Trello) from outside `src/adapters/jira/` or `src/adapters/tracker/`.

## Quality Bar

The prompt must make the target agent produce a plan that is executable, testable, parallel-aware, release-aware, and conscious of delivery workflow. Do not let the planning prompt become a vague brainstorm.
