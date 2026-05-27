# Getting started

## Requirements

- **Node.js >= 18** (for now — standalone binaries coming via the SEA toolchain on each release).
- **One AI CLI**:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code): `npm i -g @anthropic-ai/claude-code`
  - [OpenCode](https://opencode.ai): see install instructions
  - [Codex](https://github.com/openai/codex): `npm i -g @openai/codex`
- **Git** in your repo.
- *(Optional)* `gh` if you use GitHub, `glab` if you use GitLab.
- *(Optional)* An issue tracker — Jira, Linear, Notion, Trello. Without one, bode uses a local markdown file.

## Install

```bash
npm i -g bode
```

Verify:

```bash
bode --version
bode doctor
```

`bode doctor` checks your environment and tells you what's missing or misconfigured.

## First run

In any git repo:

```bash
bode "fix the dashboard ID/name bug"
```

bode:

1. Auto-detects your AI CLI from PATH.
2. Creates a local task at `<workdir>/.bode/tasks/<auto-key>.md`.
3. Opens an interactive AI session with the prompt as context.
4. Saves the planning artifact when you exit the session.

To advance:

```bash
bode continue <key>
```

Each phase (planning → implementation → review → PR) runs in its own AI session. The AI creates the branch, makes changes, opens the PR — bode just orchestrates and tracks state.

## With a Jira / Linear / GitHub Issues ticket

```bash
bode KD-312       # Jira
bode 123          # GitHub Issues (current repo)
bode ENG-42       # Linear
```

Configure your tracker in `~/.bode/config.yml`. See [Trackers / Overview](/trackers/overview).

## Where bode stores things

- `~/.bode/config.yml` — global config (Jira, default CLIs, etc.)
- `~/.bode/projects/<name>.yml` — per-project overrides (legacy; prefer `.bode.yml` in the repo)
- `~/.bode/runs/<KEY>/` — per-task artifacts (planning.md, implementation.md, review.md, branch.txt, pr.txt, meta.json, *.log)
- `<workdir>/.bode/tasks/<key>.md` — local tasks (when no external tracker is configured)
- `<workdir>/.bode.yml` — per-repo config (preferred over `~/.bode/projects/`)
