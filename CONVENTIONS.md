# Code Conventions

Standards for **Bode** and any future internal CLI/tool at Kakunyn. Follow strictly. Optimize for **readability over cleverness** and **boring over novel**.

## TypeScript

### Strictness
- `tsconfig.json` enables `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
- **No `any`.** Use `unknown` plus type guards. Use `never` for exhaustiveness checks.
- Avoid type assertions (`as`) except for narrowing after a runtime check.

### Types
- Prefer `type` over `interface` unless you need declaration merging.
- Domain types in `src/types/`. External API types co-located with adapter (e.g., `src/jira/types.ts`).
- Discriminated unions for state and results:
  ```ts
  type PhaseResult =
    | { kind: 'success'; artifact: string; logPath: string }
    | { kind: 'failed'; reason: string; logPath: string }
    | { kind: 'timeout'; logPath: string };
  ```

### Naming
- Variables and functions: `camelCase`.
- Types: `PascalCase`.
- Constants (true constants only): `UPPER_SNAKE_CASE`.
- Booleans: prefix `is`, `has`, `should`, `can`.
- Files: `kebab-case.ts`.

## Project Structure

```
src/
├── adapters/
│   ├── cli/          # CliAdapter implementations (claude-code, opencode, codex)
│   ├── jira/         # Jira REST adapter + ADF helpers (real + mock)
│   ├── tracker/      # IssueTrackerStrategy adapters (github-issues, linear, notion, trello, local/plain-markdown)
│   └── vcs/          # GitHub/GitLab PR/MR via gh/glab CLI
├── assets/           # Static assets (bode.art) embedded at build time
├── cli/
│   ├── actions/      # One file per command action
│   ├── commands.ts   # Commander command definitions
│   └── program.ts    # Program setup, version
├── config/           # config loading, schema, defaults
├── orchestrator/     # phase execution, state machine, engine
├── skills/           # skill resolution, prompt building, bundled defaults
├── storage/          # ~/.bode/ filesystem operations
├── types/            # shared domain types
├── utils/            # pure helpers
└── index.ts          # entry point

scripts/
└── build.mjs         # esbuild build script

tests/
├── unit/             # mirrors src/ structure
├── integration/      # tests with real CLIs and Jira sandbox
└── fixtures/         # sample configs, mock responses
```

Rules:
- New folder when 3+ related files exist. Don't pre-create empty structure.
- Barrel `index.ts` only at module boundaries.
- Circular imports = refactor. No exceptions.

## Imports

Order:
1. Node built-ins (`node:fs`, `node:path`)
2. External packages
3. `~/...` alias (project root)
4. Relative imports

```ts
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { loadConfig } from '~/config/loader';
import { runPhase } from './phase-runner';
```

Use `~/` alias from project root. Never `../../../`.

## Functions

- Pure when possible. Push side effects to edges.
- Max 50 lines per function. Longer = extract.
- Max 4 positional args. Beyond that, options object.
- Early returns over nested `if`. Guard clauses first.

## Error Handling

- Never swallow errors silently. Log or rethrow with context.
- Use `Result<T, E>` pattern at boundaries (Jira calls, CLI invocations, file I/O).
- Throwing acceptable inside pure logic; catch at boundary (CLI command handler).
- All external calls have explicit timeout and AbortSignal support.

```ts
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Custom error types per boundary:
- `JiraError` for Jira/MCP failures
- `CliInvocationError` for AI CLI failures (includes which CLI, exit code)
- `ConfigError` for invalid config
- `PhaseError` for orchestrator failures

## Async

- `async/await` only. No `.then()` chains.
- `Promise.allSettled` over `Promise.all` when partial failure is acceptable.
- Long-running ops accept `AbortSignal`.
- All `setTimeout`/`setInterval` cleared on exit.

## Logging

- Two layers: **terminal output** (for user) and **structured log** (for debugging).
- Terminal: `console.log` with prefixes (`✓`, `✗`, `→`). Colored via `picocolors`.
- Structured: JSON lines to `~/.bode/runs/<KEY>/<phase>.log`. Every entry has `timestamp`, `level`, `phase`, `message`, optional `extra`.
- Never log secrets, tokens, full Jira credentials.
- Levels: `debug`, `info`, `warn`, `error`. Default terminal level: `info`. Override via `--verbose`.

## CLI UX

- Every command has `--help` with examples.
- Errors exit with non-zero code and a clear message.
- Progress indication: spinners via `ora` for long ops.
- Confirmations on destructive ops (`bode abort`, `bode done`) unless `--yes` passed.
- Interactive prompts via `@inquirer/prompts` (arrow-key selection, not raw stdin).

## Build

- esbuild bundles everything to single CJS file `dist/index.js`.
- Build script: `scripts/build.mjs` (ESM, runs with Node).
- Static assets embedded via esbuild `define` (e.g., `__GOAT_ART__` from `src/assets/bode.art`).
- `__dirname` available in CJS output. `import.meta.url` not available.
- Path alias `~/` maps to `./src` via esbuild alias + tsconfig paths.

## Configuration

- YAML for human-edited configs. JSON for machine-generated state.
- Config validation via `zod` schemas. Fail fast on invalid config.
- Defaults in code, not in default config file. Config file shows only overrides.
- Sensitive values (Jira / Linear / Notion / Trello tokens) live in YAML config under `~/.bode/`. The directory should be `chmod 700`; tokens must never appear in commits, logs, telemetry payloads, or skill prompts. System-keychain storage is a future Wave 6 item.

## Testing

- Unit tests run via `npm test` (cross-platform runner at `scripts/test.mjs` that walks `tests/unit/` and spawns `node --import tsx --test`) for pure logic, config loading, skill resolution.
- Integration tests for CliAdapter implementations (run actual CLIs, may need credentials).
- Smoke test script: runs a fake Jira task end-to-end against a sandbox project.
- No tests for CLI handlers (they're thin glue, integration-tested via smoke).
- Test files in `tests/unit/` mirroring src/ structure. Run with `npm test`.
- All tests deterministic. No real timers in unit tests.

## Forbidden

- `eval`, `Function()` constructor
- `process.env.X` direct reads outside `src/config/`
- Swallowing errors with empty `catch {}`
- Committing tokens, `.env` files, or `~/.bode/config.yml` contents
- Adding a dependency without justification in the PR
- Disabling lint rules without inline comment explaining why
- Direct Jira REST calls (always via MCP adapter)
- Direct git CLI calls outside `adapters/vcs/`

## Commits and PRs

- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `perf:`.
- One logical change per PR. If you can describe it with "and", split it.
- PR description: what changed, why, how to test, output/screenshots if UX.
- All PRs must pass: `npm run check`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.
- Squash merge to `main`. Branch names: `feat/jira-mcp`, `fix/timeout-handling`.

## When Working with AI Agents

- Agent reads `AGENTS.md` and `CONVENTIONS.md` before any task.
- Agent-generated PRs follow same standards as human PRs.
- No agent commits directly to `main`.
- Agent's PR includes: files changed, validation run, one-paragraph approach summary.
- If agent disagrees with conventions, it surfaces the conflict and asks. Does not silently violate.
