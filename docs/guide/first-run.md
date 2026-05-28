# First run

This page walks you through the first 60 seconds of using bode. It assumes you already installed it ([Getting started](./getting-started)) and have at least one AI CLI on your `PATH`.

## Step 0 — Verify

```bash
bode --version
bode doctor
```

`bode doctor` prints what's missing. Common first-run findings:

- **No AI CLI detected** → install Claude Code, OpenCode, or Codex. See [Getting started → Requirements](./getting-started#requirements).
- **No tracker configured** → that's fine. bode will fall back to local markdown tasks.
- **`gh` / `glab` not authenticated** → only needed when you reach the PR phase.

## Step 1 — Just type what you want

In any git repo:

```bash
bode "fix the dashboard ID/name bug"
```

bode will:

1. Auto-detect your installed AI CLI from `PATH` (preference order: claude-code → opencode → codex).
2. Mint a local task key (e.g. `local-a3f7b2`) and write `<repo>/.bode/tasks/local-a3f7b2.md` with status `pending`.
3. Open an interactive AI session with the prompt as the planning context.
4. When you exit the session, save the planning artifact at `~/.bode/runs/local-a3f7b2/planning.md`.

If you already created the file with `bode new "..."`, bode reuses it.

## Step 2 — Advance to implementation

```bash
bode continue local-a3f7b2
```

The AI opens again, this time for implementation:

- It reads `~/.bode/runs/local-a3f7b2/planning.md` as context
- It creates the branch (`feat/local-a3f7b2`) and pushes
- It makes the changes
- When it exits, bode reads the implementation artifact

## Step 3 — Review

```bash
bode continue local-a3f7b2
```

The review phase runs the `review.md` skill on top of the diff. The verdict (APPROVE / REQUEST_CHANGES) lands in `~/.bode/runs/local-a3f7b2/review.md`.

## Step 4 — PR

```bash
bode continue local-a3f7b2
```

The AI runs `gh pr create` (or `glab mr create`) on your behalf and writes the resulting URL to `~/.bode/runs/local-a3f7b2/pr.txt`. bode marks the task `awaiting-merge`.

## Step 5 — Done

After someone reviews and merges the PR:

```bash
bode done local-a3f7b2
```

Switches back to the base branch, marks the local task `done`, removes any `bode:*` labels (if you were using an external tracker).

## All in one shot

If you trust the AI and your test suite, run everything autopiloted:

```bash
bode "fix the dashboard ID/name bug" --auto
```

Stops at PR creation so you can review. For maximum autopilot (auto-merge included):

```bash
bode "fix the dashboard ID/name bug" --dangerously-auto-merge
```

bode prints a warning before proceeding. Use only on well-tested workflows.

## Resuming

`bode` (no arguments) resumes the latest run. So if you `Ctrl+C` mid-session and come back the next day, just type `bode` and pick up where you left off.

## Next

- Hook bode to your tracker: [With Jira](./with-jira) / [With GitHub Issues](./with-github-issues) / [With Linear](./with-linear).
- Tune phase behavior: [Configuration](./configuration) → `phases`.
- Customize the prompt for each phase: [Reference → Skills](/reference/skills).
