# E2E Testing with Playwright

Playwright covers user-facing flows end-to-end. The suite has two modes:

- **`bun run test:e2e`** — runs with a mocked OpenCode server. Used on every PR and in CI. Fast, deterministic, no API key needed.
- **`bun run test:e2e:smoke`** — runs against a real `opencode serve` instance on localhost. Used manually before releases. Slower, may consume API credits.

## Setup

`playwright.config.ts` (at repo root):

```ts
import { defineConfig, devices } from '@playwright/test';

const isSmoke = process.env.E2E_MODE === 'smoke';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: isSmoke ? '**/*.smoke.spec.ts' : '**/*.spec.ts',
  testIgnore: isSmoke ? [] : '**/*.smoke.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    command: isSmoke ? 'bun run dev' : 'bun run dev:e2e',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

## Mock Strategy

`bun run dev:e2e` starts the SvelteKit dev server with an env flag (`OPENCODE_BASE_URL=http://localhost:4097`). A small mock server runs on `:4097` and serves the OpenCode API shape from fixtures.

`tests/e2e/mocks/server.ts`:

```ts
import { serve } from 'bun';
import { sessions, providers, agents } from '../fixtures';

export function startMockServer(port = 4097) {
  return serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/global/health') {
        return Response.json({ healthy: true, version: 'mock-1.0.0' });
      }

      if (url.pathname === '/session' && req.method === 'GET') {
        return Response.json(sessions);
      }

      if (url.pathname === '/session' && req.method === 'POST') {
        const newSession = {
          id: `sess_${Date.now()}`,
          title: 'New Task',
          createdAt: Date.now(),
        };
        return Response.json(newSession);
      }

      if (url.pathname === '/session/status') {
        return Response.json(
          Object.fromEntries(sessions.map((s) => [s.id, { kind: 'idle' }]))
        );
      }

      if (url.pathname === '/provider') {
        return Response.json({
          all: providers,
          default: { anthropic: 'claude-opus-4-7' },
          connected: ['anthropic', 'openai'],
        });
      }

      if (url.pathname === '/agent') {
        return Response.json(agents);
      }

      if (url.pathname === '/event') {
        // SSE stream — emit nothing by default; tests can override
        return new Response(new ReadableStream(), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }

      return new Response('Not found', { status: 404 });
    },
  });
}
```

## Fixtures

`tests/fixtures/index.ts`:

```ts
export const providers = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [{ id: 'gpt-5', name: 'GPT-5' }],
  },
];

export const agents = [
  { id: 'build', name: 'Build', description: 'Default coding agent' },
  { id: 'plan', name: 'Plan', description: 'Planning agent, read-only' },
];

export const sessions = [
  {
    id: 'sess_1',
    title: 'Add user auth flow',
    createdAt: Date.now() - 3600_000,
    updatedAt: Date.now() - 600_000,
  },
  {
    id: 'sess_2',
    title: 'Fix SSE reconnection bug',
    createdAt: Date.now() - 7200_000,
    updatedAt: Date.now() - 1200_000,
  },
];
```

## Example Specs

`tests/e2e/kanban.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Kanban Board', () => {
  test('renders existing sessions on load', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Kanban' })).toBeVisible();
    await expect(page.getByText('Add user auth flow')).toBeVisible();
    await expect(page.getByText('Fix SSE reconnection bug')).toBeVisible();
  });

  test('shows four columns', async ({ page }) => {
    await page.goto('/');

    for (const col of ['Backlog', 'In Progress', 'Review', 'Done']) {
      await expect(page.getByRole('region', { name: col })).toBeVisible();
    }
  });

  test('clicking a card opens session detail panel', async ({ page }) => {
    await page.goto('/');

    await page.getByText('Add user auth flow').click();

    const panel = page.getByRole('complementary', { name: /session detail/i });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Chat' })).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Diff' })).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Cost' })).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Tools' })).toBeVisible();
  });
});
```

`tests/e2e/create-task.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Create Task', () => {
  test('opens new task modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new task/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('creates a new task end-to-end', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new task/i }).click();

    await page.getByLabel('Title').fill('Refactor cost calculator');
    await page.getByLabel('Description').fill('Move cost logic into a pure module');
    await page.getByLabel('Model').selectOption('claude-opus-4-7');
    await page.getByLabel('Type').selectOption('refactor');
    await page.getByLabel('Priority').selectOption('medium');

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Refactor cost calculator')).toBeVisible();
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new task/i }).click();

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText(/title is required/i)).toBeVisible();
  });
});
```

`tests/e2e/stats.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Stats Page', () => {
  test('renders charts', async ({ page }) => {
    await page.goto('/stats');

    await expect(page.getByRole('heading', { name: /stats/i })).toBeVisible();
    await expect(page.getByTestId('chart-cost-per-day')).toBeVisible();
    await expect(page.getByTestId('chart-cost-per-model')).toBeVisible();
    await expect(page.getByTestId('chart-sessions-per-type')).toBeVisible();
    await expect(page.getByTestId('chart-sessions-per-status')).toBeVisible();
  });

  test('filters by period', async ({ page }) => {
    await page.goto('/stats');

    await page.getByLabel(/period/i).selectOption('7d');

    await expect(page.getByTestId('chart-cost-per-day')).toBeVisible();
  });
});
```

`tests/e2e/health.smoke.spec.ts` (smoke against real OpenCode):

```ts
import { test, expect } from '@playwright/test';

test.describe('Smoke: real OpenCode', () => {
  test('connects to local OpenCode server', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10_000 });
  });

  test('lists at least one provider', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new task/i }).click();

    const modelSelect = page.getByLabel('Model');
    const options = await modelSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });
});
```

## Running

```bash
# Standard suite (mocked, what CI runs)
bun run test:e2e

# UI mode for development
bun run test:e2e --ui

# Smoke against real OpenCode (start opencode serve first)
opencode serve --port 4096 --cors http://localhost:5173 &
E2E_MODE=smoke bun run test:e2e
```

## Rules

- Every new user-facing feature requires E2E coverage.
- Tests must pass without any sleep/setTimeout. Use `expect().toBeVisible()` with timeout.
- Use `getByRole` and `getByLabel` over `getByTestId` when possible (forces accessibility).
- Snapshots are forbidden. Write explicit assertions.
- Tests run in parallel by default. Don't share state between tests.
