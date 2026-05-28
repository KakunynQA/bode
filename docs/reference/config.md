# Config schema

Source of truth: `src/config/schema.ts` (Zod). This page documents every key.

## Global config (`~/.bode/config.yml`)

```yaml
tracker: jira                    # optional. jira | github-issues | linear | notion | trello | local | plain-markdown | mock

jira:                            # optional
  site: mycompany.atlassian.net
  default_project: KD
  email: you@company.com
  api_token: your-api-token
  transitions:                   # optional — written by `bode setup-transitions`
    planning: "In Progress"
    implementation: "In Review"
    review: "Code Review"
    awaiting_merge: "Awaiting Merge"
    done: "Done"

linear:                          # optional
  api_key: lin_api_xxx           # prefer LINEAR_API_KEY env var

notion:                          # optional
  api_token: secret_xxx          # prefer NOTION_TOKEN env var
  database_id: 00000000-0000-0000-0000-000000000000
  properties:                    # optional overrides
    title: "Name"
    status: "Status"
    tags: "Tags"

trello:                          # optional
  api_key: xxx                   # prefer TRELLO_KEY env var
  token: xxx                     # prefer TRELLO_TOKEN env var
  board_id: xxx                  # optional pin

github:                          # optional
  default_org: kakunyn

vcs:                             # optional
  provider: github               # github | gitlab — default: github

phases:                          # REQUIRED
  planning:
    cli: claude-code
    model: claude-opus-4-7
    skill: ~/.bode/skills/planning.md   # optional
    timeout_minutes: 15
  implementation:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 60
  review:
    cli: opencode
    model: claude-sonnet-4-6
    timeout_minutes: 10

gates:                           # optional
  after_planning: true
  after_implementation: true

defaults:                        # optional
  project: grid

jira_labels:                     # optional. Historical name; applies to all trackers that support tags.
  planning: bode:planning
  planned: bode:planned
  implementing: bode:implementing
  reviewing: bode:reviewing
  reviewed: bode:reviewed
  autopilot: bode:autopilot

comment_format:                  # optional
  plan_inline_max_chars: 3000
  use_emoji: true

hooks:                           # optional
  pre_planning:
    - npm run lint:fix
  post_planning:
    - run: ./.bode/hooks/notify.sh
      non_blocking: true
  pre_implementation: []
  post_implementation: []
  pre_review: []
  post_review: []
  pre_pr: []
  post_pr: []
```

### Field reference

#### `tracker`

Explicit tracker selection. When set, overrides the auto-select logic. Values:

- `jira` — uses `RealJiraAdapter`
- `github-issues` — uses `GitHubIssuesAdapter` (shells to `gh`)
- `linear` — uses `LinearAdapter` (GraphQL)
- `notion` — uses `NotionAdapter` (REST)
- `trello` — uses `TrelloAdapter` (REST)
- `local` / `plain-markdown` — uses `LocalTrackerAdapter` (markdown files)
- `mock` — uses `MockJiraAdapter` (tests only)

Omit to auto-select: Jira if `{site, email, api_token}` are all set, otherwise local.

#### `jira.site`

Atlassian subdomain. The `https://` prefix is added automatically — both `mycompany.atlassian.net` and `https://mycompany.atlassian.net` work.

#### `jira.email` + `jira.api_token`

Used together as Basic Auth (`Authorization: Basic <base64(email:token)>`). Get the token from <https://id.atlassian.com/manage-profile/security/api-tokens>.

#### `jira.default_project`

Used only by `bode start` when the key looks ambiguous (rare). Doesn't restrict which tickets you can work on.

#### `jira.transitions.<phase>`

Maps each bode phase event to a named transition in your Jira workflow. Written by `bode setup-transitions`. Leave a field unset to skip that transition.

#### `linear.api_key`

Linear API key (`lin_api_…`). Prefer the `LINEAR_API_KEY` env var.

#### `notion.api_token`, `notion.database_id`

Notion integration token (`secret_…`) and the database that holds your tasks. Share the database with the integration in Notion's UI. Prefer the `NOTION_TOKEN` env var.

#### `notion.properties`

Override the property names bode looks for. Defaults:

- `title: "Name"` (must be a `title` property)
- `status: "Status"` (must be `status` or `select`)
- `tags: "Tags"` (must be `multi_select`)

#### `trello.api_key`, `trello.token`

Get both at <https://trello.com/app-key>. Prefer the `TRELLO_KEY` + `TRELLO_TOKEN` env vars.

#### `trello.board_id`

Optional. Pins bode to one board. If omitted, bode resolves the board from the card on each call.

#### `github.default_org`

Default org passed when bode needs to create something via `gh` and the local repo doesn't disambiguate.

#### `vcs.provider`

`github` (uses `gh`) or `gitlab` (uses `glab`). Defaults to `github`.

#### `phases.<phase>`

| Field | Type | Notes |
|---|---|---|
| `cli` | string | `claude-code` / `opencode` / `codex` |
| `model` | string | Must be in `src/adapters/cli/models.ts` |
| `skill` | string (optional) | Explicit skill path. Else: `<repo>/.bode/skills/<phase>.md` → `~/.bode/skills/<phase>.md` → bundled default |
| `timeout_minutes` | number | 1 to 480 |

#### `gates`

Reserved for future use. Today bode always runs phases on-demand; gates control whether `--auto` requires explicit confirmation between phases.

#### `defaults.project`

Project name used when `--project` is not passed.

#### `jira_labels.*`

Override the per-phase label/tag names. Applies across all trackers that support tags (not just Jira despite the historical key name).

#### `comment_format.plan_inline_max_chars`

Plans larger than this are truncated when posted to the tracker. Default 3000.

#### `comment_format.use_emoji`

Toggles the 🤖 prefix on bode-generated comments. Default `true`.

#### `hooks.<hook_point>`

Array of strings or `{run: string, non_blocking?: boolean}` objects. See [Hooks](#hooks-1) below.

## Project / repo config (`~/.bode/projects/<name>.yml` or `<repo>/.bode.yml`)

```yaml
name: grid                       # REQUIRED
workdir: /home/user/projects/grid-stack   # REQUIRED, absolute path
default_branch: main             # optional

tracker: github-issues           # optional, overrides global
vcs_provider: github             # optional, overrides global

jira:                            # optional, overrides global
  site: mycompany.atlassian.net
  default_project: GRID
  transitions:
    planning: "Doing"

context_paths:                   # optional
  - .
  - ../grid-ui/src

context_files:                   # optional
  - AGENTS.md
  - CLAUDE.md

phases:                          # optional, partial overrides
  implementation:
    model: claude-opus-4-7

branch_tool: gh                  # optional

repos:                           # optional, multi-repo workflows
  - workdir: /home/user/projects/grid-api
    name: api
  - workdir: /home/user/projects/grid-ui
    name: ui

hooks:                           # optional
  pre_planning:
    - ./bin/sync-design-tokens
```

### Per-project overrides

Project config can override (but not require) keys from the global config. Only the keys you specify are overridden.

```yaml
phases:
  implementation:
    model: claude-opus-4-7   # overrides only the model; cli, timeout, skill inherit
```

### `repos[]`

Multi-repo support. Each entry has:

- `workdir` — absolute path (required)
- `name` — optional alias for logs

When set, preflight checks every `repos[].workdir` for readability. Branch creation and PR creation happen in each repo (currently sequentially; parallel multi-repo is Wave 8 work).

### `branch_tool`

Override the binary used to create branches. Defaults to `git`. Rarely useful.

## Hooks

```yaml
hooks:
  pre_implementation:
    - npm run lint:fix
    - run: ./.bode/hooks/notify.sh
      non_blocking: true
```

Hook points: `pre_planning`, `post_planning`, `pre_implementation`, `post_implementation`, `pre_review`, `post_review`, `pre_pr`, `post_pr`.

Each entry is one of:

- A string — the command to run (`non_blocking: false`)
- An object — `{run: string, non_blocking?: boolean}`

Hooks run in the project workdir. Env vars set for each hook:

| Var | Value |
|---|---|
| `BODE_TASK_KEY` | the task key (e.g. `KD-312`) |
| `BODE_PHASE` | `planning` / `implementation` / `review` / `pr` |
| `BODE_HOOK` | hook point (e.g. `pre_implementation`) |
| `BODE_WORKDIR` | absolute workdir path |

Non-zero exit aborts the phase unless `non_blocking: true`.

## Schema enforcement

bode validates the merged config with Zod on every invocation. Validation errors print the offending field with a hint:

```text
Error: invalid config at jira.api_token
  Expected string, received undefined
  Fix: set jira.api_token, or unset tracker:jira to fall back to local
```

To check without running anything:

```bash
bode doctor
```
