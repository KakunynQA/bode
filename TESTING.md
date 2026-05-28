# Testing

Bode has no UI, so testing today focuses on unit logic around config loading, skill resolution, adapter behaviour, and the orchestrator state machine. Integration and smoke layers are **planned** (see `ROADMAP.md` §Wave 6) but not yet on disk.

## Layers

| Layer | Tool | Runs | Status |
|---|---|---|---|
| Unit | `npm test` (cross-platform runner at `scripts/test.mjs` → `node --import tsx --test tests/unit/**/*.test.ts`) | Every PR, fast, deterministic | **Implemented** |
| Integration | `node --test --tag=integration` (no runner script yet) | Local with credentials, optional in CI | **Planned — Wave 6** |
| Smoke | End-to-end against a real tracker sandbox | Manual before releases | **Planned — Wave 6** |

## Unit Tests

Today's unit coverage:

- Config loading, validation, and auto-detection (`tests/unit/config/`)
- Skill resolution and prompt building (`tests/unit/skills/`)
- Result/error helpers, formatters, atomic FS, telemetry (`tests/unit/utils/`)
- Phase state machine, branch naming logic, VCS factory (`tests/unit/types/`, `tests/unit/adapters/vcs/`)
- Adapter error handling for every tracker (`tests/unit/adapters/tracker/`, `tests/unit/adapters/jira/`)
- CLI adapter registry + dangerous-flags mapping (`tests/unit/adapters/cli/`)
- Orchestrator: phase runner, preflight, hooks, PR creator (`tests/unit/orchestrator/`)
- Storage: run meta atomicity, lockfile (`tests/unit/storage/`)
- Fast path: ticket-key detection, slug generation (`tests/unit/cli/fast.test.ts`)

Rules:

- Files live under `tests/unit/` mirroring `src/` structure. Run with `npm test`.
- Mock external systems (Jira, CLI invocations, filesystem when realistic).
- No real timers (`setTimeout` etc). Use injected clock or fake timers.
- Deterministic: same input, same output, always.

Example:

```ts
// tests/unit/skills/resolver.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillPath } from '~/skills/resolver.ts';

describe('resolveSkillPath', () => {
  it('prefers project override', async () => {
    const result = await resolveSkillPath('planning', {
      projectRoot: '/fake/project',
      globalDir: '/fake/home/.bode',
      fs: mockFs({
        '/fake/project/.bode/skills/planning.md': 'project',
        '/fake/home/.bode/skills/planning.md': 'global',
      }),
    });
    assert.equal(result.ok, true);
  });
});
```

## Integration Tests (planned)

Tracked in `ROADMAP.md` §Wave 6. When implemented, will cover the adapters where mocks lie too much:

- `src/adapters/cli/*` — actually invoke each CLI with a trivial prompt, assert output structure
- `src/adapters/jira/rest.ts` — call a real Jira sandbox, create/update/delete a test issue
- `src/adapters/vcs/*` — create a real test PR/MR in a sandbox repo
- `src/adapters/tracker/*` — equivalent sandbox coverage per tracker

Required env vars when the suite lands:

- `BODE_JIRA_TEST_SITE` / `BODE_JIRA_TEST_PROJECT` / `BODE_JIRA_TEST_TOKEN`
- `BODE_GITHUB_TEST_REPO`
- *(per-tracker equivalents as they are added)*

CI will run integration tests only if these secrets are present.

## Smoke Test (planned)

Tracked in `ROADMAP.md` §Wave 6. When implemented, a single script will exercise the full happy path against a sandbox tracker (`bode start` → `bode continue` → `bode continue` → `bode done`), assert per-phase state transitions, and clean up. Today no smoke script exists; cut a release only after `npm test` + manual `bode --version` + `bode doctor` are green.

## Test Fixtures

Today's `tests/` layout:

```
tests/
└── unit/
    ├── adapters/
    │   ├── cli/        # dangerous-flags, registry
    │   ├── jira/       # adf, factory
    │   ├── tracker/    # local, github-issues, linear, notion, trello, factory, method-aliases
    │   └── vcs/        # factory, url-parse
    ├── cli/            # fast
    ├── config/         # loader, transitions, auto-detect, project-resolver, synthetic
    ├── orchestrator/   # phase-runner, preflight, pr-creator, hooks
    ├── skills/         # resolver, prompt-builder
    ├── storage/        # run-meta, lockfile
    ├── types/          # phase
    └── utils/          # format, merge, fs-atomic, errors, telemetry
```

`tests/fixtures/`, `tests/integration/`, and `tests/smoke/` directories are planned (see §Wave 6) but do not exist today. Inline mocks live alongside the tests that use them.

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` has three jobs:

1. **`validate`** — runs on every push to `main` and every PR against `main`, across Node `20`, `22`, and `24`:
   1. `npm ci`
   2. `npm run check`
   3. `npm run lint`
   4. `npm run format:check`
   5. `npm test`
   6. `npm run build`
2. **`build-artifacts`** — needs `validate`. Builds `dist/index.js` on Linux, Windows, and macOS (Node 22) and uploads each platform's artifact with 30-day retention.
3. **`release`** — needs `build-artifacts`. Triggers only on `v*` tag pushes. Runs build + `npm pack`, then creates a GitHub Release via `softprops/action-gh-release@v2` attaching `bode-*.tgz` and `dist/index.js`, with `generate_release_notes: true`.

When the integration suite lands (Wave 6), it will run on a separate workflow triggered manually or on `main` push, gated on the relevant secrets.

## Rules

- Every new feature: unit test for the logic; integration test once that layer lands.
- Every bug fix: regression test that fails before fix, passes after.
- Integration test for every new adapter (Jira REST, CLI spawn, VCS shellout).
- Snapshot-style regression tests for prompt generation.
- Tests must run in <30 seconds total (unit layer). Integration can be slower.
- Parallelize where possible. No shared mutable state across tests.

## Coverage

Run with c8:

```bash
npm run test:coverage
```

Per-module floors (enforced by CI):

| Layer | Minimum |
|-------|---------|
| Pure logic (`src/utils/`, `src/types/`) | 90% lines |
| Orchestrator (`src/orchestrator/`) | 80% lines |
| Adapters (`src/adapters/`) | 70% lines |
| CLI actions (`src/cli/`) | 60% lines |

## Running All Tests

```bash
npm run test:all       # unit + integration + smoke
npm run test:coverage  # unit with c8 coverage report
```
