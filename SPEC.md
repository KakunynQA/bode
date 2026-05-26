# DevAgent Dash — MVP Technical Specification

## Goal

Local dashboard to orchestrate and visualize OpenCode sessions. Focused on multi-model usage, Kanban view, cost tracking per model/session, and auditability of tasks executed by the team.

## Non-goals for MVP

- Does not replace the OpenCode TUI. The TUI remains where developers "talk" to the agent.
- Not a coordinated multi-agent orchestrator (like Composio AO).
- No built-in CI/CD.
- No multi-user auth in MVP (local use only).

## Tech Stack

- **Frontend:** SvelteKit in SPA mode (`adapter-static`), TypeScript, Tailwind CSS, shadcn-svelte for primitives
- **Runtime:** Bun (faster than Node for local dev)
- **Local persistence:** SQLite via `bun:sqlite` (built-in), single file at `~/.devagent-dash/data.db`
- **OpenCode communication:** Official `@opencode-ai/sdk` + direct SSE for events
- **State:** Svelte stores + TanStack Query (Svelte) for API caching
- **Build/dev:** Vite (ships with SvelteKit)
- **E2E tests:** Playwright
- **Future packaging (out of MVP):** Tauri for desktop

Rationale: SvelteKit + Bun + SQLite achieves <1s startup, instant HMR, small bundle, zero SSR overhead.

## Architecture

```
┌─────────────────────────────────────────────┐
│  DevAgent Dash (SvelteKit SPA, port 5173)   │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Kanban View  │  │ Session Detail View  │ │
│  └──────┬───────┘  └──────────┬───────────┘ │
│         │                     │             │
│  ┌──────┴─────────────────────┴───────────┐ │
│  │  API Layer (OpenCode SDK + SSE)        │ │
│  └──────┬─────────────────────────────────┘ │
│         │                                   │
│  ┌──────┴──────────┐  ┌──────────────────┐  │
│  │ SQLite local    │  │ OpenCode events  │  │
│  │ (Dash metadata) │  │ stream (SSE)     │  │
│  └─────────────────┘  └──────────────────┘  │
└─────────────────────┬───────────────────────┘
                      │ HTTP/SSE
                      ▼
        ┌──────────────────────────┐
        │  OpenCode Server         │
        │  (opencode serve :4096)  │
        └──────────────────────────┘
```

**Decision:** The Dash does not need its own backend. SvelteKit runs as a SPA and talks HTTP directly to OpenCode at `localhost:4096`. SQLite is accessed via a minimal local API served by Vite in dev, or bundled by Tauri in prod.

For the web-only MVP, a minimal Node/Bun endpoint for SQLite (3-4 routes) is enough. Everything runs via `bun run dev` in a single process.

## Data Model (SQLite)

```sql
-- Extra metadata for OpenCode sessions (OpenCode itself stores the rest)
CREATE TABLE session_metadata (
  session_id TEXT PRIMARY KEY,  -- OpenCode session ID
  kanban_column TEXT NOT NULL DEFAULT 'backlog',
  task_type TEXT,               -- 'feature' | 'fix' | 'update' | 'refactor'
  priority TEXT,                -- 'low' | 'medium' | 'high'
  tags TEXT,                    -- JSON array
  external_ref TEXT,            -- Jira/Linear/GitHub Issue link
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Per-message cost tracking (accumulated from SDK)
CREATE TABLE message_cost (
  message_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  timestamp INTEGER NOT NULL
);

-- Per-model performance (denormalized for speed)
CREATE TABLE model_stats_daily (
  date TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  sessions_count INTEGER NOT NULL,
  total_cost_usd REAL NOT NULL,
  avg_iterations REAL,
  PRIMARY KEY (date, provider_id, model_id)
);
```

## MVP Features (closed scope)

### 1. Kanban Board

- 4 fixed columns in MVP: `Backlog`, `In Progress`, `Review`, `Done`
- Cards = OpenCode sessions
- Each card shows: session title, current model, task type, accumulated cost, last update, status indicator (idle / running / waiting permission / error)
- Drag-and-drop between columns (svelte-dnd-action)
- Drag persists `kanban_column` in local SQLite

### 2. Create New Task

- "+ New Task" button opens a modal
- Fields: title, initial description (becomes first message), model (dropdown via `/provider`), agent (via `/agent`), type, priority, external link
- Submit creates session via `POST /session`, sends first message via `POST /session/:id/prompt_async`
- Card appears in `In Progress` column

### 3. Session Detail View

- Right-side panel when clicking a card
- Tabs:
  - **Chat:** session messages via `GET /session/:id/message`, live-updated via SSE
  - **Diff:** aggregated diff via `GET /session/:id/diff`
  - **Cost:** breakdown per message, model used, tokens, USD
  - **Tools:** list of tool calls (parts with `type=tool`)
- "Switch Model" button: changes model for the next prompt
- "Fork" button: creates fork via `POST /session/:id/fork`
- "Abort" button: aborts via `POST /session/:id/abort`

### 4. Metrics Dashboard

- `/stats` page
- Charts (uPlot for lightness):
  - Total cost per day (last 30d)
  - Cost per model (pie)
  - Sessions per type (bar)
  - Sessions per status (donut)
- Filters: period, model, task type

### 5. Real-time SSE Updates

- Connects to `GET /event` on boot
- Relevant events for UI:
  - `session.updated` → refresh card
  - `message.updated` → refresh chat
  - `message.part.updated` → token streaming
  - `permission.updated` → "waiting permission" badge on card
  - `session.error` → error marker
- Single global connection, broadcast via Svelte store

## OpenCode Endpoints Used

| Endpoint | Use |
|---|---|
| `GET /session` | List all sessions for Kanban |
| `GET /session/status` | Status of each session (running/idle/error) |
| `POST /session` | Create new task |
| `GET /session/:id` | Details |
| `PATCH /session/:id` | Update title |
| `DELETE /session/:id` | Delete |
| `POST /session/:id/abort` | Abort |
| `POST /session/:id/fork` | Fork |
| `GET /session/:id/message` | List messages |
| `POST /session/:id/prompt_async` | Send non-blocking message |
| `GET /session/:id/diff` | Aggregated diff |
| `GET /provider` | List available providers/models |
| `GET /agent` | List configured agents |
| `GET /event` (SSE) | Real-time event stream |
| `GET /global/health` | Boot health check |

## Dev Setup

```bash
# Prerequisites
brew install bun
npm i -g opencode-ai  # or via official installer

# Run OpenCode server
opencode serve --port 4096 --cors http://localhost:5173

# In another terminal, run the Dash
cd devagent-dash
bun install
bun run dev
# opens at http://localhost:5173
```

## Suggested File Structure

```
devagent-dash/
├── src/
│   ├── lib/
│   │   ├── opencode/         # SDK client + types
│   │   ├── db/               # SQLite schema, queries
│   │   ├── stores/           # Svelte stores (sessions, events, etc)
│   │   ├── components/
│   │   │   ├── kanban/       # Board, Column, Card
│   │   │   ├── session/      # Chat, Diff, Cost, Tools
│   │   │   ├── stats/        # Charts
│   │   │   └── ui/           # shadcn-svelte primitives
│   │   └── utils/
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +page.svelte      # Kanban
│   │   ├── stats/+page.svelte
│   │   └── api/              # internal endpoints for SQLite
│   └── app.html
├── tests/
│   ├── e2e/                  # Playwright specs
│   ├── fixtures/             # OpenCode API mocks
│   └── playwright.config.ts
├── static/
├── AGENTS.md
├── CLAUDE.md
├── CONVENTIONS.md
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Definition of Done (MVP)

- [ ] Boot under 2s from `bun run dev`
- [ ] Kanban renders existing OpenCode sessions in <500ms
- [ ] Creating a new task works end-to-end (creates session, sends prompt, appears in Kanban)
- [ ] SSE updates cards in real-time (no manual refresh)
- [ ] Drag-and-drop between columns persists to SQLite
- [ ] Costs calculated correctly from message `step-finish` parts
- [ ] Diff view renders aggregated session diff
- [ ] Switch model works (next prompt uses chosen model)
- [ ] Stats page shows at least cost per day and cost per model
- [ ] README with install and common troubleshooting
- [ ] Playwright E2E suite passes on CI with mocked OpenCode
- [ ] Smoke E2E passes against real OpenCode locally

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| OpenCode changes API breaking the Dash | Pin SDK version; smoke tests against critical endpoints |
| SSE drops and loses events | Auto-reconnect with backoff; polling fallback every 10s |
| Local SQLite corruption | Daily auto-backup to `~/.devagent-dash/backups/` |
| Performance with many sessions (>500) | Pagination in Kanban, virtual scrolling |
| Multiple team devs wanting to see same board | Out of MVP scope; v2 considers shared server |

## Out of Scope (v2+)

- Multiplayer/shared board version
- Bidirectional Jira/Linear integration
- Auto-routing of model by task type (learned heuristics)
- GitHub webhooks for creating tasks from issues/PRs
- Desktop packaging via Tauri
- Quality metrics (PRs merged without revert, human review time)
