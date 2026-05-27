---
layout: home

hero:
  name: Bode
  text: AI coding orchestrator
  tagline: Turn an issue (or a sentence) into a planned, implemented, reviewed, and PR-ready piece of work using your AI CLI of choice.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/KakunynQA/bode

features:
  - title: Works with the AI CLI you already use
    details: Claude Code, Codex, OpenCode. The AI runs in your terminal — bode preps the context and tracks the state.
  - title: Whatever tracker you use
    details: Jira, GitHub Issues, Linear, Notion, Trello, or just a local markdown file. Same `bode` command.
  - title: Zero config on first run
    details: Auto-detects your AI CLI, git remote, and project context. `bode "fix the bug"` works in any git repo.
  - title: Atomic, lockfile-protected runs
    details: Concurrent invocations of the same task don't clobber each other. State is recoverable across crashes.
  - title: Phase-aware
    details: Planning, implementation, review, PR creation. Each is its own AI session with the prior artifact in context.
  - title: Stay out of the way
    details: bode never shells out to git. The AI does all branch / push / PR operations via its own tool calls.
---

## At a glance

```bash
# Install
npm i -g bode

# In any git repo
bode "fix the dashboard ID/name bug"
```

That's it. bode picks up your installed AI CLI, creates a local task, and runs the planning phase. You drive the AI interactively in your terminal. When done, `bode continue` advances to implementation, then review, then PR creation — each handing off cleanly via files under `~/.bode/runs/<KEY>/`.

If you have Jira / GitHub Issues / Linear / Notion / Trello, point bode at it once in `~/.bode/config.yml` and `bode KD-312` picks up the ticket.
