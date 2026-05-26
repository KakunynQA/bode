# Bode 🐐

Local CLI that orchestrates AI coding work through configurable phases (planning, implementation, review), driving native AI CLIs and syncing progress to Jira.

## Install

```bash
bun install
```

## Usage

```bash
# First-time setup
bun run dev setup

# Start a task (runs planning phase)
bun run dev start KD-312

# Advance to next phase
bun run dev continue KD-312

# Check status
bun run dev status KD-312

# Show artifact (plan, implementation, review)
bun run dev show plan KD-312

# View logs
bun run dev log KD-312

# List tracked tasks
bun run dev list

# Show resolved skill paths
bun run dev skills

# Abort a task
bun run dev abort KD-312 --yes

# Mark task as done
bun run dev done KD-312 --yes
```

## Commands

| Command | Description |
|---|---|
| `bode setup` | Configure Jira OAuth, default CLIs per phase, validate connections |
| `bode start <KEY>` | Start task. Runs planning phase |
| `bode continue <KEY>` | Advance to next phase |
| `bode status <KEY>` | Show current phase and Jira link |
| `bode show <artifact> <KEY>` | Print artifact to stdout |
| `bode log <KEY>` | Show current phase log |
| `bode abort <KEY>` | Cancel execution and reset labels |
| `bode done <KEY>` | Mark task as done |
| `bode list` | List tracked tasks |
| `bode skills` | Show resolved skill paths |

## Validation

```bash
bun run check          # TypeScript typecheck
bun run lint           # ESLint
bun run format:check   # Prettier check
bun run test           # Unit tests
bun run build          # Compile to dist/
```

## Configuration

- Global: `~/.bode/config.yml`
- Project: `.bode.yml` (overrides)
- Skills: `~/.bode/skills/` or `.bode/skills/` (project override)

## License

Internal — Kakunyn
