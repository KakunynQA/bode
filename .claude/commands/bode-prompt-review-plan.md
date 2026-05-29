# Bode Prompt Review Plan

Generator block for the Plan-Review pass (between Phase 1 and Phase 2). Produces a copy-paste prompt that drives another agent through a structured second look at a plan markdown **before any code is written** in the **bode** repository. Called by `/bode-ship` between Phase 1 and Phase 2, or used standalone to vet a plan written by someone else.

Borrowed from APM's `Project_Breakdown_Review_Guide.md` — the explicit reviewer pass APM puts between breakdown and execution.

## Purpose

Catch plan defects (missing files, missing tests, missing Release Discipline, fabricated parallelism, no risk classification, no YAML frontmatter per task) **before** they turn into wasted implementation cycles. A plan that fails this review goes back to Phase 1 for revision; a plan that passes is locked and Phase 2 may begin.

## Context

You are working in the **bode** repository (`D:\projects\bode`):

- Single TypeScript repo, Node >= 20.
- Adapter boundaries: `src/adapters/{cli,vcs,jira,tracker}/` — no cross-boundary calls.
- Validation chain: `npm run check; npm run lint; npm run format:check; npm test; npm run build`.
- Release Discipline (AGENTS.md): version bump + CHANGELOG + dist rebuild + docs update on every user-facing change.

Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`, `TESTING.md` for the full picture.

## Task

The user's plan-review request is: $ARGUMENTS

`$ARGUMENTS` should be the path to a plan markdown (`.local/docs/to-implement/<slug>-plan.md` or `.local/docs/planning/<slug>-plan.md`). If empty, pick the most recent file in `.local/docs/to-implement/`.

## Required Questions

Before writing the prompt, ask only the unanswered ones:

1. **Strictness level:**
   - `strict` — block on any missing section (default for changes that touch config schema, run-meta, lockfile format, adapter interfaces, or CLI surface)
   - `pragmatic` — block on missing tests / Release Discipline / risk only (default for single-file bugfixes and docs-only work)
2. **Auto-fix mode:** if the reviewer finds gaps, should it propose patches inline (yes) or only list findings (no)?

Group all unanswered questions in a single message.

## Review Prompt Requirements

The generated prompt must instruct the target agent to:

### 1. Load the plan and the contracts

- Read the plan markdown end to end.
- Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`, `TESTING.md`, `README.md`.
- Read the `/bode-prompt-planning` contract so the reviewer knows what a complete plan looks like (especially the §Task YAML Frontmatter and §Forbidden Actions sections).

### 2. Run the structured checklist

Score each item PASS / FAIL / N-A and write a one-line note per FAIL.

**Coverage**
- [ ] All files likely to be touched are listed (not just "various files in X"). Adapter files include their corresponding registry / factory updates.
- [ ] Docs updates flagged when behaviour, commands, env vars, config schema, run-meta, or workflows change (`SPEC.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `TESTING.md`).
- [ ] Adapter boundaries respected — no plan step calls a tracker REST API or `gh` / `glab` / `git` from outside the corresponding adapter directory.
- [ ] Forbidden Actions surfaced — any new dependency, `.github/workflows/` change, test deletion, `// @ts-ignore`, or push to `main` is explicitly flagged for user approval.

**Phases**
- [ ] Every phase has a YAML frontmatter block (see `/bode-prompt-planning` §Task YAML Frontmatter).
- [ ] Every phase has explicit `objective`, `expected_output`, `validation`, `release`, and `risk` entries.
- [ ] Cross-phase dependencies are listed under `depends_on` and resolve to a real prior-phase output.
- [ ] No phase mixes unrelated scope (one cohesive change per phase).
- [ ] Long-running commands have a `watchdog` policy with timeout and termination policy.

**Parallelization**
- [ ] Wave layout present per phase (`Wave 1 parallel:` / `Gate` / `Wave 2 sequential:`).
- [ ] Anti-parallel constraints called out where they apply. Bode-specific examples:
   - version bump → `npm run build` → commit (dist must match version).
   - config schema change → loader/test updates.
   - new adapter file → registry registration → setup-wizard discovery test.
   - skill prompt change → fixture regeneration → renderer test.
- [ ] Estimated wall-clock savings vs serial.
- [ ] No fabricated parallelism — if a phase is truly serial, that's stated.

**Testing & validation**
- [ ] Targeted tests named per phase (specific spec file under `tests/`), not just "run all tests".
- [ ] Full chain (`npm run check; lint; format:check; test; build`) is the gate of the final phase.
- [ ] For bug fixes: a regression test is included, or the plan explains why it can't be (AGENTS.md §Fix workflow rule).
- [ ] For new external integration (tracker / CLI / VCS adapter): unit test + integration test both present.
- [ ] For new CLI command: `--help` text + error-case handling + exit-code checks are listed.

**Release Discipline**
- [ ] `release.bump` set per phase (patch / minor / major / none) and matches AGENTS.md §Release Discipline tiers.
- [ ] `release.changelog_section` set when bump is not `none`.
- [ ] `release.rebuild_dist: yes` whenever code under `src/` changes.
- [ ] `release.docs_to_update` lists every doc impacted; missing SPEC/README updates for new commands or flags is a BLOCK.
- [ ] Final-phase plan verifies `bode --version` against the bumped version.

**Risk**
- [ ] Every risk has a severity (LOW / MED / HIGH).
- [ ] Every HIGH risk has a mitigation or rollback plan.
- [ ] Migration / backwards-compat impact listed where it applies (config schema, run-meta, lockfile format, skill resolution order).
- [ ] `reporting.memory_log` is present when auto-mode triggers apply: multi-repo, HIGH risk, delegation, more than 4 phases, estimated work above 4 hours, or watchdog intervention.

**Delivery**
- [ ] Branch strategy stated and matches the allowed prefixes (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `perf/`).
- [ ] Commit / push / PR preferences echo what the user asked for.
- [ ] Commit message format follows `type(scope): subject` convention.

### 3. Produce a verdict

Output in this exact shape:

```
## Plan Review — <plan path> — <date>

### Verdict
APPROVED  /  APPROVED WITH MINOR CHANGES  /  CHANGES REQUESTED

### Score
- Coverage:           N/4
- Phases:             N/4
- Parallelization:    N/4
- Testing:            N/5
- Release Discipline: N/5
- Risk:               N/3
- Delivery:           N/3
- Total:              NN/28

### Findings
| Category | Severity | Finding | Suggested patch |
|----------|----------|---------|------------------|
| ...      | BLOCK / NIT | ... | ... |

### Required changes before Phase 2
- <bullet — only present when verdict is CHANGES REQUESTED>

### Recommended changes (non-blocking)
- <bullet>
```

Save the verdict to `.local/docs/to-implement/<plan-slug>-review.md` alongside the plan markdown.

### 4. Auto-fix mode (only if user enabled it)

When auto-fix is `yes` and the verdict is `APPROVED WITH MINOR CHANGES`:
- Edit the plan markdown in place to apply the suggested patches.
- Re-run the checklist once to confirm the verdict moved to `APPROVED`.
- If the verdict cannot reach `APPROVED` without restructuring whole phases, downgrade to `CHANGES REQUESTED` and stop.

When auto-fix is `no` (default), only write the review markdown — never modify the plan.

### 5. Hand-off

- If verdict is `APPROVED` or `APPROVED WITH MINOR CHANGES` (and auto-fix already brought it to APPROVED): print one line saying "Plan locked — ready for Phase 2".
- If verdict is `CHANGES REQUESTED`: print one line saying "Plan needs revision — return to Phase 1 with the Findings table" and stop.

## Output Shape

Return a copy-paste-ready prompt in English using this structure:

```
Context
<which plan, strictness, auto-fix>

Goal
<run structured plan review and produce verdict>

Plan path
<absolute or workspace-relative path>

Review checklist
<the seven categories above, condensed>

Verdict format
<the exact markdown shape above>

Auto-fix policy
<yes/no — what the reviewer is allowed to edit>

Hand-off
<APPROVED → continue; CHANGES REQUESTED → stop and return findings>
```

## Quality Bar

The reviewer must not be a cheerleader. A plan that says "phase 4: validate everything" with no specifics must fail. A plan that claims wave parallelism on steps with a real dependency (e.g., parallelizing version bump + build) must fail. A plan that adds a new CLI command without updating `SPEC.md` and `README.md` must fail. A plan that adds a new dependency without flagging it for human approval must fail. The whole point of this skill is to refuse plans that would waste implementation cycles or violate AGENTS.md.

If three or more BLOCK findings are present, the verdict MUST be `CHANGES REQUESTED` regardless of total score.
