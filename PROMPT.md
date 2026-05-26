# Generation Prompt — DevAgent Dash

Paste this into OpenCode (or Claude Code) with Opus or Sonnet 4.6/4.7 in Plan/Build mode. Attach `SPEC.md`, `CONVENTIONS.md`, `AGENTS.md`, `CLAUDE.md`, and `E2E_TESTING.md` alongside.

---

## Prompt

You will build the MVP of a local dashboard called **DevAgent Dash**. The full specification is in the attached `SPEC.md`. Code standards are in `CONVENTIONS.md`. Operating rules for AI agents are in `AGENTS.md` (Claude-specific notes in `CLAUDE.md`). E2E testing setup is in `E2E_TESTING.md`. **Read all of them in full before starting.**

**Working language:** English. All code, comments, commit messages, documentation, identifiers, error messages, and PR descriptions are in English. No exceptions.

**Mandatory stack** (do not deviate, do not suggest alternatives):
- SvelteKit 2.x with `adapter-static` (pure SPA mode)
- Svelte 5 with runes (`$state`, `$derived`, `$effect`, `$props`)
- Strict TypeScript
- Tailwind CSS 4.x
- shadcn-svelte for UI primitives
- Bun as runtime and package manager
- `bun:sqlite` for local persistence
- `@opencode-ai/sdk` for OpenCode communication
- TanStack Query (Svelte variant) for API caching
- `svelte-dnd-action` for drag-and-drop
- `uPlot` for charts on the stats page
- Playwright for E2E tests

**Quality bar** (enforced by `CONVENTIONS.md`):
- TypeScript strict, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- No `any` (use `unknown` + type guards)
- All Svelte components use runes, no legacy reactivity
- No inline CSS, Tailwind only
- Accessibility: aria-labels, visible focus, keyboard navigation on the Kanban
- Dark theme by default, light theme as toggle
- All async code supports AbortSignal

**Execution phases** (one at a time, request approval between phases):

### Phase 1 — Bootstrap
1. Create SvelteKit project with Bun
2. Configure Tailwind, shadcn-svelte, `adapter-static`
3. Set up TanStack Query globally
4. Set up SQLite with the schema from `SPEC.md` (simple in-code migrations)
5. Configure OpenCode SDK client with base URL `http://localhost:4096`
6. Set up Playwright per `E2E_TESTING.md`, including the mock server
7. Set up ESLint, Prettier, and the validation scripts from `AGENTS.md`
8. Smoke test: run `bun run dev`, open the page, show "connected" message if OpenCode health check passes

### Phase 2 — Kanban Board (read-only)
1. Fetch `GET /session` and render the list
2. Layout four columns (Backlog, In Progress, Review, Done)
3. Card shows: title, model, accumulated cost, status badge
4. Fetch status via `GET /session/status`, map to badges
5. 5s polling as fallback (SSE comes in Phase 4)
6. E2E coverage for the read-only kanban

### Phase 3 — Create Task
1. "+ New Task" button at the top of the Kanban
2. Modal with fields: title, description, model (dropdown via `GET /provider`), agent, type, priority, external link
3. Submit: `POST /session` → `POST /session/:id/prompt_async` → save metadata to local SQLite
4. Close modal, card appears in "In Progress"
5. E2E coverage for create-task flow

### Phase 4 — Real-time SSE
1. Connect `GET /event` on app boot, hold via a global store
2. Auto-reconnect with exponential backoff (max 30s)
3. Map relevant events to stores: `session.updated`, `message.updated`, `message.part.updated`, `permission.updated`, `session.error`
4. Kanban cards update in real-time
5. SSE connection indicator in the UI corner
6. E2E coverage: mock the SSE stream from fixtures, assert UI reacts

### Phase 5 — Session Detail
1. Right-side slide-in panel when clicking a card (~50% screen width)
2. Tabs: Chat, Diff, Cost, Tools
3. Chat: messages via `GET /session/:id/message`, SSE updates, auto scroll-to-bottom
4. Diff: `GET /session/:id/diff`, render with diff2html or similar lightweight lib
5. Cost: per-message table with tokens/cost from `message_cost` in SQLite
6. Tools: list of tool calls in the session (filter parts by `type=tool`)
7. Actions: Switch Model, Fork, Abort, Delete
8. E2E coverage per tab

### Phase 6 — Drag and Drop
1. Implement drag between columns using `svelte-dnd-action`
2. On drop, update `kanban_column` in SQLite
3. Optimistic UI (immediate move, rollback on failure)
4. Keyboard accessibility: move card with arrow keys when focused
5. E2E coverage for dnd flow

### Phase 7 — Stats
1. `/stats` route
2. Daily aggregations computed from `message_cost`
3. Four charts via uPlot: cost per day, cost per model (pie), sessions per type (bar), sessions per status (donut)
4. Filters: period (7d/30d/90d), model, type
5. E2E coverage for stats rendering and filters

### Phase 8 — Polish and Hardening
1. Complete README (install, setup, troubleshooting)
2. Loading states on every fetch
3. Error boundaries with retry
4. Auto-backup of SQLite on boot to `~/.devagent-dash/backups/`
5. Keyboard shortcuts: `N` (new task), `/` (search), `Esc` (close panels)
6. Full smoke E2E suite against real OpenCode runs cleanly

**Execution rules**:
- Before each phase, present the plan and wait for "ok" to proceed
- Small commits (one commit per sub-task)
- Separate branch per phase, PR at the end of each
- Run `bun run check`, `bun run lint`, `bun run test`, `bun run test:e2e` before every commit
- If you find ambiguity in any doc, ask before assuming
- Do not add dependencies outside the mandatory stack without justifying in the PR

**Definition of Done per phase**:
- Build passes with no warnings
- Strict TypeScript with no `any`
- Works end-to-end on the happy path
- E2E test added for the new feature
- README updated if setup changed
- PR description follows the template in `AGENTS.md`

Start with Phase 1. Present the detailed plan before executing.
