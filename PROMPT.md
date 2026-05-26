# Generation Prompt — Bode

Paste this into OpenCode or Claude Code with Opus 4.7 in Plan/Build mode. Attach `SPEC.md`, `CONVENTIONS.md`, `AGENTS.md`, `CLAUDE.md`, `TESTING.md`, and `SKILLS.md` alongside.

---

## Prompt

You will build the MVP of **Bode**, a local CLI that orchestrates AI coding work through configurable phases and syncs progress to Jira. The full specification is in the attached `SPEC.md`. Code standards in `CONVENTIONS.md`. Operating rules for AI agents in `AGENTS.md` (Claude-specific notes in `CLAUDE.md`). Testing strategy in `TESTING.md`. Skill prompts in `SKILLS.md`. **Read all of them in full before starting.**

**Working language:** English. All code, comments, commit messages, documentation, identifiers, error messages, and PR descriptions in English. No exceptions.

**Mandatory stack** (do not deviate):
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Bun runtime and package manager
- `commander` for CLI
- `zod` for config validation
- `keytar` for credential storage
- `picocolors` for terminal colors
- `ora` for spinners
- `yaml` for config parsing
- `@modelcontextprotocol/sdk` for MCP Atlassian integration
- `bun test` for unit tests
- No frontend, no database, no server

**Quality bar** (enforced by `CONVENTIONS.md`):
- No `any`. Use `unknown` + type guards.
- Discriminated unions for state and results.
- Result<T, E> pattern at boundaries.
- Pure functions when possible.
- Max 50 lines per function.
- All async ops support AbortSignal and explicit timeouts.

**Execution phases** (one at a time, request approval between phases):

### Phase 1 — Bootstrap
1. Create Bun project, configure TypeScript strict, ESLint, Prettier.
2. Set up project structure per `CONVENTIONS.md`.
3. Implement `bun run dev`, `check`, `lint`, `test`, `build` scripts.
4. Set up bun test with sample passing test.
5. Implement basic CLI shell with `commander`: `bode --help` shows commands, each command stubbed with "not implemented" message.
6. README with install instructions and command list.

### Phase 2 — Config and Storage
1. Define config schema with `zod` (matches `SPEC.md`).
2. Implement config loader: global → project → defaults precedence.
3. Implement `~/.bode/` directory bootstrap (create dirs on first run).
4. Implement skill resolution per `SKILLS.md`.
5. Bundle default skills in package.
6. Unit tests for config loading, skill resolution, validation errors.

### Phase 3 — Jira Adapter (via MCP)
1. Implement `JiraAdapter` interface with methods: `getIssue`, `addComment`, `transitionStatus`, `addLabel`, `removeLabel`, `attachFile`.
2. MCP Atlassian client wrapper.
3. OAuth flow stored via keytar.
4. Unit tests with mocked MCP responses.
5. Integration test against sandbox (skipped if no credentials).

### Phase 4 — CLI Adapter Interface
1. Define `CliAdapter` interface: `invoke(prompt, model, timeout, signal): Promise<Result>`.
2. Implement `ClaudeCodeAdapter` (headless mode via `claude --print` or equivalent).
3. Implement `OpenCodeAdapter` (via `opencode run`).
4. Adapter registry.
5. Unit tests with mocked spawn.
6. Integration tests invoking real CLIs with trivial prompts (skipped if not installed).

### Phase 5 — Orchestrator
1. Define phase state machine: `planning → planned → implementing → reviewing → reviewed → done`.
2. Implement `PhaseRunner`: loads skill, builds context, invokes CLI adapter, captures output, posts to Jira, updates labels.
3. Implement run storage: `~/.bode/runs/<KEY>/` with meta.json, logs, artifacts.
4. Handle large artifacts: inline in Jira comment if under threshold, attachment otherwise.
5. Unit tests for state transitions, large artifact handling.

### Phase 6 — CLI Commands
Implement all commands per `SPEC.md`:
1. `bode setup` — interactive config wizard
2. `bode start <KEY>` — begins planning phase
3. `bode continue <KEY>` — advances to next phase
4. `bode status <KEY>` — shows current state
5. `bode show <artifact> <KEY>` — prints artifact
6. `bode log <KEY>` — tails active log
7. `bode abort <KEY>` — cancels execution
8. `bode done <KEY>` — closes task
9. `bode list` — lists tracked tasks
10. `bode skills` — shows resolved skills
11. Each command has `--help` with examples
12. Each command supports `--json` for machine-readable output

### Phase 7 — VCS Adapter
1. Implement `VcsAdapter` interface.
2. GitHub implementation via `gh` CLI (assume installed and authenticated).
3. PR creation at end of implementation phase.
4. Add PR link to Jira comment.
5. Integration test with sandbox repo.

### Phase 8 — Autopilot Mode
1. Detect `bode:autopilot` label on `bode start`.
2. Skip gates, run all phases sequentially.
3. If any phase fails, stop and report.
4. Tests for autopilot flow and failure handling.

### Phase 9 — Polish and Smoke
1. Complete README with: install, setup, first task walkthrough, troubleshooting.
2. Smoke test script (`bun run smoke`) exercising the full workflow against a sandbox.
3. Error message audit: every failure mode in `SPEC.md` produces a useful message.
4. Logging audit: nothing sensitive logged at info level.
5. `bode --version` works.
6. Tag v0.1.0.

**Execution rules**:
- Before each phase, present the plan and wait for "ok" to proceed
- Small commits (one per sub-task)
- Separate branch per phase, PR at the end
- Run `bun run check`, `bun run lint`, `bun run test` before every commit
- If you find ambiguity in any doc, ask before assuming
- Do not add dependencies outside the mandatory stack without justifying in the PR

**Definition of Done per phase**:
- Build passes with no warnings
- Strict TypeScript with no `any`
- Works end-to-end on the happy path
- Unit tests for new logic
- Integration test for new external integration (or noted why skipped)
- README updated if setup changed
- PR description follows the template in `AGENTS.md`

Start with Phase 1. Present the detailed plan before executing.
