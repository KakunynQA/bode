# AGENTS.md

Instructions for AI coding agents (Claude Code, OpenCode, Codex, Cursor, etc.) working in the Bode repository. Read this file before any task. If you cannot follow these rules, stop and ask.

## Project Context

**Bode** is a local CLI (v0.4.0) that orchestrates AI coding work through configurable phases (planning, implementation, review), driving native AI CLIs and syncing progress to Jira. See `SPEC.md` for full requirements. See `CONVENTIONS.md` for code standards.

## Commands

```bash
# Install
npm install

# Dev (runs CLI from source via tsx)
npm run dev -- setup
npm run dev -- start KD-312

# Validation (run before any commit)
npm run check                  # TypeScript typecheck
npm run lint                   # ESLint
npm run format:check           # Prettier check
npm run build                  # Compile to dist/ via esbuild

# Global install from source
npm run build && npm pack && npm i -g bode-*.tgz

# Global install from GitHub (note: may not work on Windows/npm 11 due to symlink bugs)
npm i -g KakunynQA/bode
```

## Architecture Summary

- TypeScript strict, Node.js runtime (>=18), no DB (filesystem at `~/.bode/`)
- Built with esbuild to single CJS bundle in `dist/index.js`
- Jira via Atlassian MCP server (no direct REST) — currently using mock adapter
- AI CLIs invoked via `child_process` in headless mode through `CliAdapter` interface
- Config in YAML (`~/.bode/config.yml`, project `.bode.yml`)
- Skill prompts in markdown (`~/.bode/skills/`, project `.bode/skills/`)
- Interactive setup uses `@inquirer/prompts` for arrow-key selection
- ASCII art embedded via esbuild `define` from `src/assets/bode.art`

## Supported AI CLIs

| CLI | Command | Adapter File |
| --- | --- | --- |
| Claude Code | `claude` | `src/adapters/cli/claude-code.ts` |
| OpenCode | `opencode` | `src/adapters/cli/opencode.ts` |
| Codex | `codex` | `src/adapters/cli/codex.ts` |
| Z.AI | `zai-coding` | `src/adapters/cli/zai.ts` |

Available models per CLI are defined in `src/adapters/cli/models.ts`.

## Key Files

| File | Purpose |
| --- | --- |
| `src/index.ts` | CLI entry point |
| `src/cli/program.ts` | Commander program setup, version |
| `src/cli/commands.ts` | All command definitions |
| `src/cli/actions/setup.ts` | Interactive setup wizard with @inquirer/prompts |
| `src/cli/actions/start.ts` | Start task (planning phase) |
| `src/cli/actions/continue.ts` | Advance to next phase |
| `src/orchestrator/phase-runner.ts` | Core phase execution logic |
| `src/orchestrator/engine.ts` | Phase advancement with spinners |
| `src/config/schema.ts` | Zod config validation schema |
| `src/config/loader.ts` | YAML config loading with project/global merge |
| `src/skills/resolver.ts` | Skill file resolution (project > global > bundled) |
| `src/adapters/cli/models.ts` | Per-CLI model registry |
| `src/adapters/cli/registry.ts` | CLI adapter registry |
| `src/assets/bode.art` | ASCII goat art (embedded at build time) |
| `scripts/build.mjs` | esbuild build script (injects __GOAT_ART__) |

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml`:
- **Validate**: check + lint + build on Node 20/22/24
- **Build Artifacts**: upload dist/index.js for Linux/Windows/macOS
- **Release**: auto-release on `v*` tags with tarball + dist

## Definition of Done

Every change must satisfy all of these before opening a PR:

- [ ] `npm run check` passes (no type errors)
- [ ] `npm run lint` passes (no warnings)
- [ ] `npm run format:check` passes
- [ ] `npm run build` succeeds
- [ ] New code follows `CONVENTIONS.md`
- [ ] New external integration (Jira op, CLI adapter, VCS op): unit test + integration test
- [ ] New CLI command: `--help` text, error cases handled, exits with correct codes
- [ ] No `console.log` debug statements
- [ ] No `TODO` without owner: `// TODO(name): ...`
- [ ] PR description: what / why / how to test

## Forbidden Actions

Require explicit human approval. Do not perform autonomously:

- Adding new dependencies to `package.json`
- Changing files in `.github/workflows/`
- Deleting tests
- Disabling lint rules or TypeScript errors via `// @ts-ignore`, `// eslint-disable`
- Pushing directly to `main`
- Force-pushing to shared branches
- Calling Jira REST API directly (always use MCP adapter)

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
When adding a new AI CLI adapter:
1. Read existing adapters in `src/adapters/cli/` for pattern.
2. Implement `CliAdapter` interface via `BaseCliAdapter`.
3. Add to adapter registry in `src/adapters/cli/registry.ts`.
4. Add models to `src/adapters/cli/models.ts`.
5. Update `bode setup` interactive flow — it auto-discovers from registry.
6. Document any new config keys in `SPEC.md`.

## Working with Jira (via MCP)

- All Jira ops go through `src/adapters/jira/`.
- Never call Jira REST directly from anywhere else.
- Currently using mock adapter. Real MCP Atlassian adapter to be implemented.
- Every Jira op has timeout (default 30s) and explicit error handling.

## Working with AI CLIs

- All CLI invocations go through `CliAdapter` in `src/adapters/cli/`.
- Each adapter handles: spawn, stdin/stdout/stderr capture, timeout, exit code interpretation.
- Never log raw prompts containing user code/secrets to terminal at info level (debug only).
- Capture full output to `~/.bode/runs/<KEY>/<phase>.log` for audit.

## Skill Prompts

- Skill files are user-editable. Don't refactor them automatically.
- When testing skill rendering, use fixture skills in `tests/fixtures/skills/`, not real ones.
- Skill resolution order: project `.bode/skills/<name>.md` > global `~/.bode/skills/<name>.md` > bundled defaults.

## Commit Messages

Format: `type(scope): subject`

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`

Examples:
- `feat(jira): add label transition on phase change`
- `fix(cli-adapter): handle non-zero exit from claude-code gracefully`
- `refactor(orchestrator): extract phase state machine`

## When Unsure

Stop and ask. Don't guess on:
- Architecture decisions not covered in `SPEC.md`
- Whether to add a dependency
- Whether to refactor adjacent code
- How to handle a Jira/CLI edge case not specified

A clarification question is always better than a wrong implementation.

## Quality Bar

Every PR is reviewed as if by a senior engineer. We value:
- Small, focused changes
- Clear naming
- Tests that document behavior
- Honest commit messages
- No clever code without justification
