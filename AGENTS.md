# AGENTS.md

Instructions for AI coding agents (Claude Code, OpenCode, Codex, Cursor, etc.) working in the Bode repository. Read this file before any task. If you cannot follow these rules, stop and ask.

## Project Context

**Bode** is a local interactive TUI shell (v2.0.0) that orchestrates AI coding work through configurable phases (planning, plan-review, implementation, review, PR creation), driving native AI CLIs interactively (terminal handoff). v2.0.0 replaces the one-shot commander CLI with an Ink-powered persistent shell: running `bode` opens a screen with a header, prompt, and footer, and every subcommand (`setup`, `start KD-1`, etc.) is typed inside without the `bode ` prefix. `bode --version` and `bode --help` remain as headless escape hatches; nothing else runs without a TTY. See `SPEC.md` for full requirements. See `CONVENTIONS.md` for code standards.

## Commands

```bash
# Install
npm install

# Dev (launches the TUI shell from source via tsx)
npm run dev                    # → type `setup`, `start KD-312`, etc. at the prompt

# Validation (run before any commit)
npm run check                  # TypeScript typecheck
npm run lint                   # ESLint
npm run format:check           # Prettier check
npm run build                  # Bundle to dist/index.js (ESM) via esbuild

# Global install from source
npm run build && npm pack && npm i -g bode-*.tgz

# Verify install
bode --version                 # headless: prints the version
bode --help                    # headless: prints command list
bode                           # launches the TUI shell (needs a TTY)
```

## Architecture Summary

- TypeScript strict, Node.js runtime (>=20), no DB (filesystem at `~/.bode/`)
- Built with esbuild to single CJS bundle in `dist/index.js`
- Jira via REST API v3 (Basic Auth with API Token) — mock adapter as fallback
- AI CLIs invoked via `child_process` in headless mode through `CliAdapter` interface
- Branch lifecycle handled by the AI CLI itself (v0.18.0 removed direct git shellouts); bode follows GitHub Flow conventions for branch naming and merge strategy
- VCS adapters for both GitHub (`gh`) and GitLab (`glab`) in `src/adapters/vcs/`
- Multi-project config system with per-project overrides in `~/.bode/projects/`
- Context gathering (AGENTS.md + file tree) injected into prompts
- Jira transitions per column (In Progress → In Review → Code Review → Done)
- Summary comments posted to Jira cards for every phase
- Config in YAML (`~/.bode/config.yml`, project `.bode.yml`, project configs `~/.bode/projects/<name>.yml`)
- Skill prompts in markdown (`~/.bode/skills/`, project `.bode/skills/`)
- Interactive setup uses `@inquirer/prompts` for arrow-key selection
- ASCII art embedded via esbuild `define` from `src/assets/bode.art`

## Supported AI CLIs

| CLI | Command | Adapter File |
| --- | --- | --- |
| Claude Code | `claude` | `src/adapters/cli/claude-code.ts` |
| OpenCode | `opencode` | `src/adapters/cli/opencode.ts` |
| Codex | `codex` | `src/adapters/cli/codex.ts` |

Available models per CLI are defined in `src/adapters/cli/models.ts`.

## Key Files

| File | Purpose |
| --- | --- |
| `src/index.ts` | CLI entry point |
| `src/cli/program.ts` | Commander program setup, version |
| `src/cli/commands.ts` | All command definitions |
| `src/cli/actions/setup.ts` | Interactive setup wizard with @inquirer/prompts |
| `src/cli/actions/start.ts` | Start task (planning phase) with interactive prompts for dirty workdir + existing run |
| `src/cli/actions/init.ts` | Scaffold AGENTS.md for a repo |
| `src/cli/actions/learn.ts` | Generate .bode/context.md project context |
| `src/cli/actions/abort.ts` | Task abort logic + `abortRun()` reusable helper |
| `src/cli/actions/continue.ts` | Advance to next phase |
| `src/orchestrator/phase-runner.ts` | Core phase execution logic |
| `src/orchestrator/engine.ts` | Phase advancement with spinners |
| `src/orchestrator/branch-manager.ts` | Branch lifecycle management (create, conflict check, PR) |
| `src/orchestrator/preflight.ts` | Validates workdir + context_paths + repos[] are readable before invoking the CLI (v0.12.0) |
| `src/orchestrator/validation-gate.ts` | Runs configured validation commands before PR creation |
| `src/orchestrator/release-gate.ts` | Enforces version/changelog release discipline when configured |
| `src/cli/dangerous-check.ts` | Warns about `--approve-all-dangerous` and detects CLIs without bypass support (v0.13.0) |
| `src/cli/missing-artifact.ts` | Interactive `[retry/continue/abort]` prompt when an AI session exits without writing the artifact (v0.13.0) |
| `src/orchestrator/pr-creator.ts` | Hands off PR creation to the AI; reads URL from `~/.bode/runs/<KEY>/pr.txt` after exit (v0.16.0) |
| `src/config/transitions.ts` | Resolves `jira.transitions.<phase>` per project, falling back to global config, then defaults (v0.15.0) |
| `src/cli/summary.ts` | Per-phase artifact paths + end-of-task summary printer (v0.15.0) |
| `src/adapters/jira/rest.ts` | Real Jira REST adapter with ADF body + 30s timeout (v0.11.0) |
| `src/adapters/jira/adf.ts` | Atlassian Document Format helpers (v0.11.0) |
| `src/config/schema.ts` | Zod config validation schema |
| `src/config/loader.ts` | YAML config loading with project/global merge |
| `src/config/projects.ts` | Project config loader |
| `src/config/project-resolver.ts` | Interactive project selection + YAML writer |
| `src/config/context.ts` | Context gathering (AGENTS.md, file tree) |
| `src/skills/resolver.ts` | Skill file resolution (project > global > bundled) |
| `src/adapters/cli/models.ts` | Per-CLI model registry |
| `src/adapters/cli/registry.ts` | CLI adapter registry |
| `src/adapters/vcs/gitlab.ts` | GitLab MR adapter (glab CLI) |
| `src/adapters/vcs/github.ts` | GitHub PR adapter (gh CLI) |
| `src/adapters/vcs/factory.ts` | VCS adapter factory (github/gitlab) |
| `src/adapters/jira/factory.ts` | Jira adapter factory |
| `src/assets/bode.art` | ASCII goat art (embedded at build time) |
| `scripts/build.mjs` | esbuild build script (injects __GOAT_ART__) |

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml`:
- **Validate**: check + lint + format:check + test + build on Node 20/22/24
- **Build Artifacts**: upload dist/index.js for Linux/Windows/macOS
- **Release**: auto-release on `v*` tags with tarball + dist

## Release Discipline (always, no need to be reminded)

Every user-facing change ships as a release. Without being asked, you MUST:

1. **Bump version** in `package.json` using semver:
   - `patch` (0.11.0 → 0.11.1) for bug fixes, internal refactors, docs-only.
   - `minor` (0.11.0 → 0.12.0) for new features, new CLI flags, new adapters, new commands.
   - `major` (0.11.0 → 1.0.0) for breaking changes to CLI surface, config schema, or run-meta format.
2. **Update `CHANGELOG.md`** under a new dated `## [X.Y.Z] — YYYY-MM-DD` section. Use `### Added / Changed / Fixed / Removed` subsections per Keep a Changelog.
3. **Update relevant docs** in the same commit:
   - `SPEC.md` — any change to behavior, schema, commands, flags, lifecycle.
   - `README.md` — any change to commands, flags, install steps, requirements.
   - `AGENTS.md` / `CLAUDE.md` — any change to workflow rules, validation chain, project structure.
   - `CONVENTIONS.md` — any change to code standards.
   - `TESTING.md` — any change to test layout or how to run tests.
4. **Rebuild `dist/`** (`npm run build`) so the committed bundle matches the new version.
5. **Verify** by running `bode --version` against the built binary and confirming the new number.

If you skip any of the above, you are not done. The user should not need to ask "did you bump the version?" or "did you update the docs?"

## Definition of Done

Every change must satisfy all of these before opening a PR:

- [ ] `npm run check` passes (no type errors)
- [ ] `npm run lint` passes (no warnings)
- [ ] `npm run format:check` passes
- [ ] `npm test` passes (with new tests for new logic, regression tests for fixes)
- [ ] `npm run build` succeeds and `dist/index.js` is committed
- [ ] Version bumped in `package.json` per the Release Discipline above
- [ ] `CHANGELOG.md` updated under a new version section
- [ ] Affected docs updated (SPEC/README/AGENTS/CLAUDE/CONVENTIONS/TESTING)
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
- Calling any tracker API (Jira, GitHub Issues, Linear, Notion, Trello) directly from outside `src/adapters/jira/` or `src/adapters/tracker/`

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

### VCS adapter workflow
When adding a new VCS provider:
1. Read existing adapters in `src/adapters/vcs/` for pattern.
2. Implement the VCS adapter interface (see `github.ts` or `gitlab.ts`).
3. Register in `src/adapters/vcs/factory.ts`.
4. Add config schema keys in `src/config/schema.ts`.
5. Update `bode setup` interactive flow — it auto-discovers from factory.
6. Document any new config keys in `SPEC.md`.

## Working with Jira (via MCP)

- All Jira ops go through `src/adapters/jira/`. The real Jira REST adapter (v3 + ADF, 30s timeout) lives there alongside the mock.
- For non-Jira trackers (GitHub Issues, Linear, Notion, Trello, plain-markdown), use the `IssueTrackerStrategy` implementations in `src/adapters/tracker/`. Never call any tracker REST/GraphQL API directly from outside the corresponding adapter.
- Every tracker op has an explicit timeout and structured error handling.

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
