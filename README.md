# Bode 🐐

Local dashboard for orchestrating and visualizing OpenCode sessions. Built by the Kakunyn internal product team.

## Stack

- **SvelteKit 2** SPA (`adapter-static`), Svelte 5 with runes
- **TypeScript** strict mode
- **Tailwind CSS 4** with dark/light theme
- **Bun** runtime
- **SQLite** via `bun:sqlite` for local metadata
- **OpenCode** communication via `@opencode-ai/sdk` + SSE
- **Playwright** for E2E tests

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- OpenCode running at `localhost:4096` (for real API features)

## Getting Started

```bash
bun install
bun run dev
```

Opens at http://localhost:5173

## Commands

```bash
bun run dev              # Start dev server on :5173
bun run build            # Production build
bun run check            # TypeScript typecheck
bun run lint             # ESLint
bun run format:check     # Prettier check
bun run format           # Prettier write
bun run test             # Unit tests (bun test)
bun run test:e2e         # Playwright E2E with mocked OpenCode
bun run test:e2e:smoke   # Playwright smoke against real OpenCode
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── kanban/       # Board, Column, Card, StatusBadge
│   │   └── session/      # SessionDetailPanel
│   ├── opencode/         # SDK client + SSE connection
│   ├── stores/           # Svelte stores (sessions, connection, theme)
│   ├── types/            # Domain types
│   └── utils/            # Pure helpers
├── routes/
│   ├── +page.svelte      # Kanban Board
│   └── stats/+page.svelte # Metrics Dashboard
tests/
├── e2e/                  # Playwright specs
├── fixtures/             # Mock data
└── playwright.config.ts
```

## Features (MVP)

- **Kanban Board** — 4 columns (Backlog, In Progress, Review, Done) with drag-and-drop
- **Create Task** — Modal to create new OpenCode sessions with model/agent selection
- **Session Detail** — Slide-in panel with Chat, Diff, Cost, and Tools tabs
- **Real-time SSE** — Auto-reconnecting event stream for live updates
- **Stats Dashboard** — Cost and session analytics with charts
- **Dark/Light Theme** — Toggle with persistent preference

## Configuration

Environment variables (optional):

| Variable | Default | Description |
|---|---|---|
| `VITE_OPENCODE_BASE_URL` | `http://localhost:4096` | OpenCode server URL |

## License

Internal — Kakunyn
