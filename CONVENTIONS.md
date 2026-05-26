# Code Conventions

These conventions apply to **DevAgent Dash** and any future internal product at Kakunyn. Follow them strictly. When in doubt, optimize for **readability over cleverness** and **boring over novel**.

## TypeScript

### Strictness
- `tsconfig.json` must enable `"strict": true`, `"noUncheckedIndexedAccess": true`, and `"exactOptionalPropertyTypes": true`.
- **No `any`.** Use `unknown` plus type guards. Use `never` for exhaustiveness checks in switches.
- Avoid type assertions (`as`) except for narrowing after a runtime check or for known-safe DOM casts.

### Types
- Prefer `type` over `interface` unless you genuinely need declaration merging.
- Domain types live in `src/lib/types/`. API DTO types are imported from `@opencode-ai/sdk`.
- Discriminated unions for state machines:
  ```ts
  type SessionStatus =
    | { kind: 'idle' }
    | { kind: 'running'; startedAt: number }
    | { kind: 'error'; reason: string };
  ```

### Naming
- Variables and functions: `camelCase`.
- Types and components: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` only for true constants (env-derived, magic numbers). Otherwise `camelCase`.
- Boolean variables: prefix with `is`, `has`, `should`, `can`. Example: `isLoading`, `hasError`.
- Files: `kebab-case.ts` for modules, `PascalCase.svelte` for components.

## Svelte 5

- Use **runes only**: `$state`, `$derived`, `$effect`, `$props`. No legacy `let` reactivity.
- Components are `.svelte` files. One component per file.
- Component props: typed with `$props<{ ... }>()` syntax, all props explicit.
- No global mutable state in components. Shared state goes through Svelte stores in `src/lib/stores/`.
- Effects (`$effect`) are last resort. Prefer derived values.
- Event handlers: `onclick={...}`, not `on:click={...}` (Svelte 5 syntax).

## Styling

- Tailwind utilities only. No inline `style` attributes except for dynamic values that can't be expressed in Tailwind (e.g., computed colors from data).
- No custom CSS files except the global Tailwind base in `app.css`.
- Component library: **shadcn-svelte** primitives. Don't reinvent buttons, dialogs, dropdowns.
- Dark theme is the default. Light theme is a toggle, not a fork.
- Spacing scale: stick to Tailwind's default (4, 6, 8, 12, 16, 24). Avoid arbitrary values like `p-[13px]`.

## File Organization

```
src/lib/
├── opencode/        # OpenCode SDK client + thin wrappers
├── db/              # SQLite schema, migrations, queries
├── stores/          # Svelte stores
├── components/
│   ├── kanban/
│   ├── session/
│   ├── stats/
│   └── ui/          # shadcn-svelte primitives only
├── types/           # Domain types
└── utils/           # Pure helpers (date, format, etc)
```

**Rules:**
- A folder gets created when there are 3+ related files. Don't pre-create empty structure.
- `index.ts` barrel files only at the boundary of a logical module. Don't barrel everything.
- Circular imports = code smell. Refactor.

## Imports

Order:
1. Node/Bun built-ins
2. External packages
3. `$lib/...` aliases
4. Relative imports

```ts
import { readFileSync } from 'node:fs';
import { createClient } from '@opencode-ai/sdk';
import { sessionStore } from '$lib/stores/session';
import { formatCost } from './format';
```

Use `$lib/...` alias, never deep relative paths (`../../../`).

## Functions

- Pure functions when possible. Side effects pushed to the edges.
- Max 50 lines per function. If longer, extract.
- Max 4 positional arguments. If more, take an options object.
- Early returns over nested `if`. Guard clauses first.

```ts
// Good
function calculateCost(message: Message): number {
  if (!message.usage) return 0;
  if (message.usage.totalTokens === 0) return 0;
  return message.usage.totalTokens * RATE_PER_TOKEN;
}

// Bad
function calculateCost(message: Message): number {
  let cost = 0;
  if (message.usage) {
    if (message.usage.totalTokens > 0) {
      cost = message.usage.totalTokens * RATE_PER_TOKEN;
    }
  }
  return cost;
}
```

## Error Handling

- Never swallow errors silently. Log or rethrow with context.
- Use `Result<T, E>` pattern (`{ ok: true, value } | { ok: false, error }`) for operations that can fail at boundaries (API calls, DB ops).
- Throwing is acceptable inside pure logic; catch at the boundary (component, route handler).
- All API calls have explicit timeout and abort signal support.

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchSession(id: string): Promise<Result<Session>> {
  try {
    const value = await client.session.get(id);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
```

## Async

- `async/await` only. No `.then()` chains.
- Always handle the rejection case. Use `Promise.allSettled` over `Promise.all` when partial failure is acceptable.
- Long-running ops accept an `AbortSignal`.

## Database (SQLite)

- All queries in `src/lib/db/queries/` as named exported functions.
- No SQL inline in routes or components.
- Prepared statements for any query with parameters.
- Schema changes via numbered migration files: `migrations/001_initial.sql`, `migrations/002_add_tags.sql`.
- Never run destructive migrations automatically. Require explicit flag.

## Comments

- Comments explain **why**, not **what**. The code already says what.
- TODO comments must include an owner and a context: `// TODO(rofli): refactor when SSE retry strategy is decided`.
- Outdated comments are worse than no comments. Delete them.
- JSDoc only on public exports of `src/lib/` modules. Components don't need JSDoc unless the prop names aren't self-evident.

## Testing

- E2E with Playwright. Run on every PR.
- Unit tests with `bun test` for pure utilities (`src/lib/utils/`) and DB query layer.
- No tests for components. Component behavior is covered by E2E.
- Test files live next to the code: `format.ts` + `format.test.ts`.
- E2E specs live in `tests/e2e/`.
- All tests must be deterministic. No `setTimeout` in test code, use `expect.poll` or `waitFor`.

## Commits and PRs

- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.
- One logical change per PR. If you can describe it with "and", split it.
- PR description includes: what changed, why, how to test, screenshots if UI.
- All PRs must pass: `bun run check` (typecheck), `bun run lint`, `bun run test`, `bun run test:e2e`.
- Squash merge to main. Branch names: `feat/kanban-dnd`, `fix/sse-reconnect`.

## Forbidden

- `eval`, `Function()` constructor
- `process.env.X` direct reads outside `src/lib/config.ts`
- `localStorage`/`sessionStorage` for anything other than user UI preferences
- Adding a dependency without justification in the PR description
- Disabling lint rules without a comment explaining why
- Committing `.env` files or secrets
- Direct DOM manipulation. Use Svelte bindings.

## When Working with AI Agents

- The agent must read `AGENTS.md` and `CONVENTIONS.md` before any task.
- Agent-generated PRs follow the same standards as human PRs.
- No agent commits directly to `main`.
- Agent must include in the PR: list of files changed, validation run (typecheck, lint, tests, build), and a one-paragraph summary of approach.
