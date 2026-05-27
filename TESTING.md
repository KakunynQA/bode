# Testing

Bode has no UI, so testing focuses on unit logic, integration with external systems, and end-to-end smoke against a real Jira sandbox.

## Layers

| Layer | Tool | Runs |
|---|---|---|
| Unit | `node --test` | Every PR, fast, deterministic |
| Integration | `node --test --tag=integration` | Local with credentials, optional in CI with secrets |
| Smoke | Custom script `npm run smoke` | Manual before releases |

## Unit Tests

Cover:
- Config loading and validation (`src/config/`)
- Skill resolution and prompt building (`src/skills/`)
- Result type helpers, formatters (`src/utils/`)
- Phase state machine transitions (`src/types/phase.ts`)
- Adapter error handling (mock the external calls)

Rules:
- Co-located with code: `loader.ts` → `loader.test.ts`
- Mock external systems (Jira, CLI invocations, filesystem when realistic)
- No real timers (`setTimeout` etc). Use injected clock or fake timers.
- Deterministic: same input, same output, always

Example:

```ts
// src/skills/resolver.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillPath } from './resolver';

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

## Integration Tests

Cover the adapters where mocks lie too much:
- `src/adapters/cli/*` — actually invoke each CLI with a trivial prompt, assert output structure
- `src/adapters/jira/*` — call real Jira sandbox, create/update/delete a test issue
- `src/adapters/vcs/*` — create a real test PR in a sandbox repo

Tagged so they skip when credentials absent:

```ts
import { it } from 'node:test';

const hasJiraCreds = !!process.env.BODE_JIRA_TEST_SITE;

it.skipIf(!hasJiraCreds)('integration: jira add comment', async () => {
  // real call
});
```

Required env vars for integration tests (documented in README):
- `BODE_JIRA_TEST_SITE` — sandbox site URL
- `BODE_JIRA_TEST_PROJECT` — sandbox project key
- `BODE_JIRA_TEST_TOKEN` — service account token for tests only
- `BODE_GITHUB_TEST_REPO` — sandbox repo for PR tests

CI runs integration tests only if these secrets are present.

## Smoke Test

A single script that exercises the full happy path against the sandbox:

```bash
npm run smoke
```

What it does:
1. Creates a sandbox Jira ticket: "Smoke test: add hello world endpoint"
2. Runs `bode start <KEY>` → expects status `In Progress`, label `bode:planned`, plan comment posted
3. Runs `bode continue <KEY>` → expects label `bode:reviewing`, PR opened
4. Runs `bode continue <KEY>` → expects label `bode:reviewed`, review comment on PR
5. Runs `bode done <KEY>` → expects status `Done`, all bode labels removed
6. Cleans up: deletes Jira ticket, closes PR, removes test branch

Run manually before tagging a release. Smoke output is human-readable: pass/fail per step with timing.

## Test Fixtures

```
tests/
├── fixtures/
│   ├── configs/         # sample bode configs
│   ├── skills/          # sample skill prompts
│   ├── jira-responses/  # JSON snapshots of real Jira responses (for mocks)
│   └── cli-outputs/     # sample outputs from each AI CLI
├── unit/                # mirrors src/
├── integration/         # adapter tests
└── smoke/               # smoke script
```

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every PR:

1. `npm ci`
2. `npm run check`
3. `npm run lint`
4. `npm run format:check`
5. `npm run test` (unit only)
6. `npm run build`

On `v*` tags: creates GitHub Release with tarball and dist artifact.

Integration tests run on a separate workflow triggered manually or on `main` push, if secrets are configured.

## Rules

- Every new feature: unit test for the logic, integration test if it touches external systems.
- Every bug fix: regression test that fails before fix, passes after.
- No tests for thin CLI command handlers (covered by smoke).
- No snapshot tests. Explicit assertions only.
- Tests must run in <30 seconds total (unit layer). Integration can be slower.
- Parallelize where possible. No shared mutable state across tests.
