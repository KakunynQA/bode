# Configuration

bode reads YAML from three locations and merges them. Lowest level wins.

## Resolution order

1. **Project config** — `~/.bode/projects/<name>.yml` (per-project, opt-in)
2. **Repo config** — `<repo>/.bode.yml` (preferred for per-repo overrides)
3. **Global config** — `~/.bode/config.yml`
4. **Built-in defaults**

The `--project <name>` flag forces a specific project entry from `~/.bode/projects/`.

## Global config (`~/.bode/config.yml`)

Created by `bode setup`. Holds tracker credentials, AI CLI choices per phase, VCS provider.

```yaml
tracker: jira      # jira | github-issues | linear | notion | trello | local

jira:
  site: mycompany.atlassian.net
  default_project: KD
  email: you@company.com
  api_token: your-api-token

vcs:
  provider: github  # or "gitlab"

github:
  default_org: myorg

phases:
  planning:
    cli: claude-code
    model: claude-opus-4-7
    timeout_minutes: 15
  implementation:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 60
  review:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 10

defaults:
  project: grid
```

See [Reference → Config schema](/reference/config) for the full schema.

## Repo config (`<repo>/.bode.yml`)

Preferred way to scope settings to one repo. Lives in version control so the whole team gets the same behavior.

```yaml
name: grid
workdir: /home/user/projects/grid-stack
default_branch: main

tracker: github-issues   # override global tracker for this repo

context_paths:
  - .
  - ../grid-ui/src

context_files:
  - AGENTS.md
  - CLAUDE.md

phases:
  implementation:
    model: claude-opus-4-7

hooks:
  pre_implementation:
    - npm run lint:fix
```

## Project config (`~/.bode/projects/<name>.yml`)

Legacy location. Same schema as `.bode.yml`. Use it when you want a project profile to follow you across multiple checkouts of the same repo. Selected via `--project <name>`.

## Tracker credentials — env vars first

bode reads credentials from env vars before YAML for the providers that support it:

| Tracker | Env var(s) | YAML fallback |
|---|---|---|
| Linear | `LINEAR_API_KEY` | `linear.api_key` |
| Notion | `NOTION_TOKEN`, `NOTION_DATABASE_ID` | `notion.api_token`, `notion.database_id` |
| Trello | `TRELLO_KEY`, `TRELLO_TOKEN` | `trello.api_key`, `trello.token` |
| GitHub Issues | uses `gh auth` | n/a |
| Jira | n/a | `jira.email` + `jira.api_token` |

Prefer env vars in CI and shared dev environments — the YAML file ends up in `~/.bode/` which may be backed up or synced.

## Per-phase overrides

Each phase has the same shape:

```yaml
phases:
  planning:
    cli: claude-code           # which adapter (claude-code | opencode | codex)
    model: claude-opus-4-7     # see src/adapters/cli/models.ts for the registry
    skill: ~/.bode/skills/planning.md  # optional — override resolution
    timeout_minutes: 15        # 1 to 480
```

A project config can override only the fields it cares about:

```yaml
phases:
  implementation:
    model: claude-opus-4-7   # everything else inherits from global
```

## Tracker selection logic

In order:

1. `force` (test-only)
2. `tracker:` in project `.bode.yml`
3. `tracker:` in global `~/.bode/config.yml`
4. Jira (if `jira.{site, email, api_token}` are all set)
5. `LocalTrackerAdapter` (markdown tasks under `<repo>/.bode/tasks/`)

So a repo with no config gets local markdown tasks. Set `tracker:` once globally and forget about it.

## Validating config

```bash
bode doctor
```

Reads everything, runs the Zod schema validation (`src/config/schema.ts`), and reports per-field problems.

## Editing safely

bode never edits your config behind your back, except for two commands:

- `bode setup` and `bode setup-project` — interactive wizards that write only the keys that differ from defaults.
- `bode setup-transitions` — writes `jira.transitions` (or the equivalent per tracker).

Everything else reads-only. Hand-edit YAML when you want full control.

## Next

- [Phases](./phases) — how each phase runs and how to customize it
- [Reference → Config schema](/reference/config) — every key, every type
- [Reference → CLI commands](/reference/cli) — every command, every flag
