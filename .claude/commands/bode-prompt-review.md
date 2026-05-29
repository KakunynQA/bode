# Bode Prompt Review

Generator block for Phase 3 (Review). Produces a copy-paste prompt that drives another agent through the full validation gate for the **bode** repository. Called by `/bode-ship` when assembling the Review phase, or used standalone for external delegation.

## Purpose

Produce a prompt that runs the full quality gate for a bode branch before it is pushed or merged. The review agent runs the npm validation chain, validates Release Discipline (version bump + CHANGELOG + rebuilt dist), confirms the global install works, and produces a structured pass/fail report. Nothing is pushed or merged until every gate passes.

## Context

You are working in the **bode** repository (`D:\projects\bode`):

- Single TypeScript repo, Node >= 20.
- Validation chain (per AGENTS.md §Commands and §Definition of Done):
   - `npm run check` — TypeScript typecheck
   - `npm run lint` — ESLint (no warnings allowed)
   - `npm run format:check` — Prettier
   - `npm test` — full test suite
   - `npm run build` — esbuild → `dist/index.js`
- Release Discipline gate (per AGENTS.md):
   - `package.json` version bumped
   - `CHANGELOG.md` has a new dated section matching that version
   - `dist/index.js` was rebuilt for the new version
   - `bode --version` from the installed bundle prints the new version
- CI workflow: `.github/workflows/ci.yml` runs check + lint + format:check + test + build on Node 20/22/24, then build-artifacts, then release on `v*` tags.

Read `AGENTS.md`, `TESTING.md`, `CONVENTIONS.md` for the full picture.

## Task

The user's review request is: $ARGUMENTS

If `$ARGUMENTS` is empty, run the full review gate on the current branch.

## Required Questions

Before writing the final prompt, ask only the missing questions from this list. If the user already answered one in `$ARGUMENTS`, skip it.

1. Scope — which checks to include:
   - Full chain (check + lint + format:check + test + build) — default
   - Subset (e.g., `test` only, or `lint` only) — specify which
2. Should the agent skip the Release Discipline check? (only sensible for in-progress drafts that are not ready to ship)
3. Should the agent perform the global-install smoke test (`npm pack && npm i -g bode-*.tgz && bode --version`)?
4. If all gates pass, should the agent push the branch and open a PR?

Group all unanswered questions in a single message.

## Review Prompt Requirements

The generated prompt must instruct the target agent to:

### 1. Read context first
- Read `AGENTS.md` (especially §Commands, §Definition of Done, §Release Discipline, §Forbidden Actions).
- Read `TESTING.md` for test layout and how to run focused tests.
- Identify the current branch and working tree state.
- Identify the version in `package.json` and confirm a matching dated section exists in `CHANGELOG.md`.

### 2. Run the validation chain (primary gate)

Run from the repo root, in this order. Each must pass before the next runs.

```bash
npm run check           # TypeScript typecheck — zero errors
npm run lint            # ESLint — zero warnings
npm run format:check    # Prettier — clean
npm test                # full test suite — all pass
npm run build           # esbuild — produces dist/index.js
```

Allowed subset variants are listed in the §Required Questions answers.

### 3. Run the Release Discipline gate (unless skipped)

- `package.json` version was bumped vs the base branch.
- `CHANGELOG.md` has a new top section `## [<new-version>] — <today>` with at least one entry under `### Added` / `### Changed` / `### Fixed` / `### Removed`.
- `dist/index.js` was rebuilt — its embedded version (extracted via `bode --version` after install, or via running the bundle directly) matches `package.json`.
- Relevant docs were touched when behaviour / schema / commands changed (`SPEC.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `TESTING.md`).

### 4. Run the global-install smoke test (if requested)

```bash
npm run build
npm pack
npm i -g bode-*.tgz
bode --version          # must print the bumped version
```

On Windows / npm 11 symlink quirks, fall back to running the packed tarball directly with `node` and assert the printed version.

### 5. Produce a structured report

After all gates run, produce a report in this format:

```
## Review Report — <branch-name> — <date>

### Validation chain
| Check              | Result | Notes |
|--------------------|--------|-------|
| npm run check      | PASS   |       |
| npm run lint       | PASS   |       |
| npm run format:check | PASS |       |
| npm test           | PASS   | X tests, Y ms |
| npm run build      | PASS   | dist/index.js size: Z KB |

### Release Discipline
| Check                     | Result | Notes |
|---------------------------|--------|-------|
| package.json bumped       | PASS   | 0.28.2 → 0.29.0 |
| CHANGELOG.md new section  | PASS   | ## [0.29.0] — 2026-05-27 |
| dist rebuilt for version  | PASS   |       |
| docs touched as needed    | PASS   | SPEC.md, README.md |

### Smoke test (if requested)
| Check          | Result | Notes |
|----------------|--------|-------|
| npm pack       | PASS   |       |
| global install | PASS   |       |
| bode --version | PASS   | prints 0.29.0 |

### Issues found
<list any failures, warnings, deprecations, or skipped gates — empty if none>

### Recommendation
READY TO SHIP / NEEDS FIXES
```

Save this report to `.local/docs/to-implement/<branch-slug>-review.md` (do not commit).

### 6. On READY TO SHIP — deliver

If all gates pass and the user requested push + PR:
- Push the current branch.
- Open a PR with a body that includes the validation table and the CHANGELOG entry text.
- Monitor CI with `gh pr checks <pr-number>`. On failure, fetch logs with `gh run view <run-id> --log-failed`, fix root cause, commit, push, repeat.
- Resolve actionable review comments; dismiss false positives with a one-sentence rationale.
- Deliver the PR link.

### 7. On NEEDS FIXES — stop and report

If any gate fails:
- Do NOT push.
- Do NOT open a PR.
- Do NOT `--no-verify` or otherwise bypass hooks.
- List every failing check with the exact error or log excerpt and the file/line if applicable.
- Recommend the fix for each failure.
- Wait for the user to instruct next steps.

## Output Shape

Return a copy-paste-ready prompt in English using this structure:

```
Context
<branch and bode repo context>

Goal
<run full quality gate and report>

Review scope
<chain subset, Release Discipline yes/no, smoke test yes/no, push+PR yes/no>

Gate sequence
<validation chain → Release Discipline → smoke test → report>

Report format
<structured pass/fail tables>

Delivery
<push + PR only if all gates pass — or stop and report>

Constraints
<no push on failure, no --no-verify, no @ts-ignore to make lint pass, dist must match version>
```

## Quality Bar

The review prompt must produce a complete, honest gate. No cherry-picking passing checks. No pushing on partial pass. The npm validation chain plus Release Discipline together form the gate — both must pass. If `dist/index.js` does not match `package.json`'s version, the gate fails even if every other check is green.
