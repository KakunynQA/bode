# AGENTS.md

This file instructs AI coding agents (Claude Code, OpenCode, Codex, Cursor, etc.) on how to work in this repository. Read this file before any task. If you cannot follow these rules, stop and ask.

## Project Context

**DevAgent Dash** is a local dashboard for orchestrating and visualizing OpenCode sessions, built by the Kakunyn internal product team. See `SPEC.md` for full requirements. See `CONVENTIONS.md` for code standards.

## Commands

```bash
# Install
bun install

# Dev
bun run dev                    # starts SvelteKit dev server on :5173

# Validation (run before any commit)
bun run check                  # TypeScript typecheck
bun run lint                   # ESLint
bun run format:check           # Prettier check
bun run test                   # Unit tests (bun test)
bun run test:e2e               # Playwright E2E with mocked OpenCode
bun run test:e2e:smoke         # Playwright smoke against real OpenCode (local only)
bun run build                  # Production build

# DB
bun run db:migrate             # Apply pending migrations
bun run db:reset               # Drop and recreate (DEV ONLY)
```

## Architecture Summary

- SvelteKit 2 SPA (`adapter-static`), Svelte 5 with runes
- TypeScript strict mode, no `any`
- Bun runtime
- SQLite via `bun:sqlite` for local metadata
- OpenCode communication via `@opencode-ai/sdk`
- SSE for real-time events
- Playwright for E2E

## Definition of Done

Every change must satisfy all of these before opening a PR:

- [ ] `bun run check` passes (no type errors)
- [ ] `bun run lint` passes (no warnings)
- [ ] `bun run format:check` passes
- [ ] `bun run test` passes
- [ ] `bun run test:e2e` passes
- [ ] `bun run build` succeeds
- [ ] New code follows `CONVENTIONS.md`
- [ ] If new UI: E2E coverage added
- [ ] If new API integration: unit test covering happy path and error
- [ ] PR description includes: what changed, why, how to test
- [ ] No `console.log`, `TODO` without owner, or commented-out code

## Forbidden Actions

These require explicit human approval. Do not perform them autonomously:

- Editing `migrations/` files that have already been applied to any database
- Adding new dependencies to `package.json`
- Changing any file inside `.github/workflows/`
- Modifying `AGENTS.md`, `CLAUDE.md`, or `CONVENTIONS.md`
- Touching auth, secrets, or any code that handles `OPENCODE_SERVER_PASSWORD`
- Deleting tests
- Disabling lint rules or TypeScript errors with `// @ts-ignore`, `// eslint-disable`, etc.
- Pushing directly to `main`
- Force-pushing to shared branches
- Running `bun run db:reset` against a non-local database

## Workflow Rules

### For any task

1. Read `SPEC.md` and `CONVENTIONS.md` if you haven't this session.
2. Work in a branch named `feat/...`, `fix/...`, `refactor/...`, `chore/...`, or `docs/...`.
3. Commit in small logical chunks. Use conventional commits.
4. Run validation before pushing.
5. Open a PR with a clear description.

### Feature workflow

1. Restate the goal in your own words. Confirm before proceeding.
2. Identify acceptance criteria. List them in the PR description.
3. Map affected files. Read them before editing.
4. Create or update Playwright E2E test that exercises the feature.
5. Implement minimally. Don't refactor unrelated code.
6. Validate. Open PR.

### Fix workflow

1. Reproduce the bug. Write a failing test first.
2. Make the minimum change to pass the test.
3. Run full validation to confirm no regression.
4. PR description must include: root cause, fix description, test added.

**Rule:** No bug fix without a regression test, unless impossible or uneconomical. If you skip the test, explain why in the PR.

### Update workflow

1. Identify what is being updated (dependency, API, schema, config).
2. List impact: what files use the thing being updated.
3. Read the changelog or migration guide. Cite it in the PR.
4. Update in one focused PR. Don't bundle unrelated upgrades.
5. Run full E2E. Note any new behaviors in the PR.

## Working with OpenCode API

- Always use `@opencode-ai/sdk`, not raw `fetch`, unless the SDK doesn't expose the endpoint.
- Wrap all calls in `Result<T, E>` pattern (see `CONVENTIONS.md`).
- Every call needs explicit timeout and AbortSignal support.
- Never log API responses with raw user prompts or model outputs to console in production.
- SSE: single connection, reconnect with exponential backoff (max 30s), polling fallback at 10s.

## Working with SQLite

- All queries in `src/lib/db/queries/` as named functions.
- Use prepared statements for any parameterized query.
- Migrations are append-only. Never edit applied migrations.
- New tables require a migration file with both up and down (down is for local rollback).

## Testing Guidance

- Unit tests: cover `src/lib/utils/` and `src/lib/db/queries/` thoroughly.
- E2E tests: cover user flows end-to-end with mocked OpenCode.
- Smoke E2E: minimal flow against real OpenCode, run manually before releases.
- Tests must be deterministic. No real timers, no flaky waits. Use `expect.poll`.
- Snapshot testing is forbidden. Write explicit assertions.

## Commit Messages

Format: `type(scope): subject`

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`

Examples:
- `feat(kanban): add drag-and-drop between columns`
- `fix(sse): handle reconnection after network drop`
- `refactor(db): extract migration runner`
- `test(e2e): cover create-task flow`

## PR Template

```markdown
## What
One-line summary.

## Why
Context and motivation.

## How
Approach in 2-3 sentences. Mention non-obvious decisions.

## Validation
- [ ] typecheck
- [ ] lint
- [ ] unit tests
- [ ] E2E
- [ ] build
- [ ] manual smoke test (describe)

## Screenshots / Recordings
If UI changes.

## Notes for reviewer
Anything worth flagging.
```

## When You Are Unsure

Stop and ask. Don't guess on:
- Architecture decisions not covered in SPEC.md
- Whether to add a dependency
- Whether to refactor adjacent code
- How to handle an edge case not covered by tests

A short clarification question is always better than a wrong implementation.

## Quality Bar

Every PR is reviewed as if by a senior engineer. We value:
- Small, focused changes
- Clear naming
- Tests that document behavior
- Honest commit messages
- No clever code without justification
