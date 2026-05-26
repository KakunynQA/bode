# AGENTS.md

Instructions for AI coding agents (Claude Code, OpenCode, Codex, Cursor, etc.) working in the Bode repository. Read this file before any task. If you cannot follow these rules, stop and ask.

## Project Context

**Bode** is a local CLI that orchestrates AI coding work through configurable phases (planning, implementation, review), driving native AI CLIs and syncing progress to Jira. See `SPEC.md` for full requirements. See `CONVENTIONS.md` for code standards.

## Commands

```bash
# Install
bun install

# Dev
bun run dev <subcommand>       # runs CLI from source, e.g. `bun run dev start KD-312`

# Validation (run before any commit)
bun run check                  # TypeScript typecheck
bun run lint                   # ESLint
bun run format:check           # Prettier check
bun run test                   # Unit tests
bun run test:integration       # Integration tests (need credentials, run locally)
bun run build                  # Compile to dist/

# Smoke
bun run smoke                  # End-to-end against Jira sandbox
```

## Architecture Summary

- TypeScript strict, Bun runtime, no DB (filesystem at `~/.bode/`)
- Jira via Atlassian MCP server (no direct REST)
- AI CLIs invoked via `child_process` in headless mode through `CliAdapter` interface
- Config in YAML (`~/.bode/config.yml`, project `.bode.yml`)
- Skill prompts in markdown (`~/.bode/skills/`, project `.bode/skills/`)

## Definition of Done

Every change must satisfy all of these before opening a PR:

- [ ] `bun run check` passes (no type errors)
- [ ] `bun run lint` passes (no warnings)
- [ ] `bun run format:check` passes
- [ ] `bun run test` passes
- [ ] `bun run build` succeeds
- [ ] New code follows `CONVENTIONS.md`
- [ ] New external integration (Jira op, CLI adapter, VCS op): unit test + integration test
- [ ] New CLI command: `--help` text, error cases handled, exits with correct codes
- [ ] No `console.log` debug statements
- [ ] No `TODO` without owner: `// TODO(rofli): ...`
- [ ] PR description: what / why / how to test

## Forbidden Actions

Require explicit human approval. Do not perform autonomously:

- Modifying `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `SPEC.md`
- Touching `src/adapters/jira/` auth code or anything reading from keychain
- Adding new dependencies to `package.json`
- Changing files in `.github/workflows/`
- Deleting tests
- Disabling lint rules or TypeScript errors via `// @ts-ignore`, `// eslint-disable`
- Pushing directly to `main`
- Force-pushing to shared branches
- Calling Jira REST API directly (always use MCP adapter)
- Reading or writing to `~/.bode/config.yml` of the user's actual installation during tests (use a temp dir fixture)

## Workflow Rules

### Any task
1. Read `SPEC.md` and `CONVENTIONS.md` if not already read this session.
2. Work on branch named `feat/...`, `fix/...`, `refactor/...`, `chore/...`, `docs/...`.
3. Commit in small logical chunks. Conventional commits.
4. Run validation before pushing.
5. Open PR with clear description.

### Feature workflow
1. Restate the goal. Confirm before proceeding.
2. Identify acceptance criteria.
3. Map affected files. Read them before editing.
4. If integration with external system: add integration test (skippable if no credentials).
5. Implement minimally. Don't refactor unrelated code.
6. Validate. Open PR.

### Fix workflow
1. Reproduce the bug. Write failing test first.
2. Minimum change to pass.
3. Full validation to confirm no regression.
4. PR description: root cause, fix, test added.

Rule: no bug fix without a regression test, unless impossible or uneconomical. If skipped, explain why in PR.

### CLI adapter workflow
When adding a new AI CLI adapter (e.g., gemini-cli, aider):
1. Read existing adapters in `src/adapters/cli/` for pattern.
2. Implement `CliAdapter` interface.
3. Add to adapter registry.
4. Add integration test that invokes the real CLI with a trivial prompt.
5. Document any new config keys in `SPEC.md`.
6. Update `bode setup` interactive flow to offer the new option.

## Working with Jira (via MCP)

- All Jira ops go through `src/adapters/jira/`.
- Never call Jira REST directly from anywhere else.
- Auth tokens come from keychain via `keytar`. Never read tokens from env in code.
- Every Jira op has timeout (default 30s) and explicit error handling.
- Mock the adapter in unit tests; use real sandbox project in integration tests.

## Working with AI CLIs

- All CLI invocations go through `CliAdapter` in `src/adapters/cli/`.
- Each adapter handles: spawn, stdin/stdout/stderr capture, timeout, exit code interpretation.
- Never log raw prompts containing user code/secrets to terminal at info level (debug only).
- Capture full output to `~/.bode/runs/<KEY>/<phase>.log` for audit.

## Skill Prompts

- Skill files are user-editable. Don't refactor them automatically.
- When testing skill rendering, use fixture skills in `tests/fixtures/skills/`, not real ones.
- Skill resolution order: project `.bode/skills/<name>.md` > global `~/.bode/skills/<name>.md` > bundled defaults.

## Testing Guidance

- Unit tests: pure logic, config parsing, skill resolution, result types.
- Integration tests: real CLI invocations, real Jira sandbox. Tagged so they skip without credentials.
- Smoke test: full workflow end-to-end. Run manually before releases.
- No snapshots. Explicit assertions only.
- Test data in `tests/fixtures/`, never inline mega-strings.

## Commit Messages

Format: `type(scope): subject`

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`

Examples:
- `feat(jira): add label transition on phase change`
- `fix(cli-adapter): handle non-zero exit from claude-code gracefully`
- `refactor(orchestrator): extract phase state machine`
- `test(skills): cover project override resolution`

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
- [ ] integration tests (or noted why skipped)
- [ ] build
- [ ] manual smoke (describe)

## Notes for reviewer
Anything worth flagging.
```

## When Unsure

Stop and ask. Don't guess on:
- Architecture decisions not covered in `SPEC.md`
- Whether to add a dependency
- Whether to refactor adjacent code
- How to handle a Jira/CLI edge case not specified
- Whether a skill prompt should be modified

A clarification question is always better than a wrong implementation.

## Quality Bar

Every PR is reviewed as if by a senior engineer. We value:
- Small, focused changes
- Clear naming
- Tests that document behavior
- Honest commit messages
- No clever code without justification
