# Trackers — Notion

Lives at `src/adapters/tracker/notion.ts`. Treats a Notion database as the task list; each database page is a task.

## Auth

1. Create a Notion integration at <https://www.notion.so/my-integrations>
2. Copy the **Internal Integration Token** (starts with `secret_…`)
3. In Notion, open your task database, click **`...`** → **Add connections** → select your integration. (Without this, the integration can't see the database.)
4. Copy the database ID from the URL: `https://www.notion.so/myworkspace/<DATABASE_ID>?v=…`

Prefer env vars:

```bash
export NOTION_TOKEN="secret_xxx"
export NOTION_DATABASE_ID="00000000-0000-0000-0000-000000000000"
```

Or YAML:

```yaml
tracker: notion
notion:
  api_token: secret_xxx
  database_id: 00000000-0000-0000-0000-000000000000
```

## Database requirements

The database must have at least three properties:

| Default name | Notion property type | Purpose |
|---|---|---|
| `Name` | `title` | The task title |
| `Status` | `status` OR `select` | The bode phase |
| `Tags` | `multi_select` | Phase labels and any custom tags |

Override the names if your database uses different ones:

```yaml
notion:
  properties:
    title: "Task"
    status: "Phase"
    tags: "Bode"
```

The status property can be either Notion's `status` type (Kanban-style) or a `select` type — bode auto-detects.

## Task keys

Notion uses **page IDs** (UUIDs). bode generates a friendly key from the title when you create a task via `bode new`, but the underlying identifier is the page ID. You'll see both in the meta.json.

For `bode <key>`, the form is the page ID (the UUID from the page URL, with or without dashes).

## Status mapping

Default mapping if you don't customize:

| bode phase | Notion Status value (default) |
|---|---|
| planning | "In Progress" |
| implementation | "In Review" |
| review | "In Review" |
| awaiting_merge | "In Review" |
| done | "Done" |

Run `bode setup-transitions` to map to your database's actual status values.

## Comments

Notion comments live at the page level. `postComment(key, body)` runs `POST /v1/comments` with the page reference.

Notion comments support a limited subset of rich text — bode posts plaintext (markdown source). Headings and lists render as text, not as Notion blocks.

## Branch naming

Notion doesn't have a typed "issue type". bode looks for hints in the page's tags:

| Tag present | Branch prefix |
|---|---|
| `bug` | `fix/` |
| `feature`, `enhancement` | `feat/` |
| `refactor` | `refactor/` |
| `chore` | `chore/` |
| (anything else) | `feat/` |

## API contract

REST endpoint: `https://api.notion.com/v1`. Headers: `Authorization: Bearer <token>`, `Notion-Version: 2022-06-28`.

| Method | Notion endpoint |
|---|---|
| `fetchTask(key)` | `GET /pages/{page_id}` + property reads |
| `postComment(key, body)` | `POST /comments` with `parent.page_id` |
| `setStatus(key, name)` | `PATCH /pages/{page_id}` with status property |
| `addTag(key, tag)` / `removeTag(key, tag)` | `PATCH /pages/{page_id}` with multi_select diff |
| `listStatuses(key)` | reads the database schema and returns the status property's options |
| `attachFile(...)` | no-op (Notion has files, but bode doesn't wire it) |

Every call has a 30 s timeout. `Notion-Version` is pinned to `2022-06-28` to insulate against schema migrations.

## Failure modes

| Symptom | Likely cause |
|---|---|
| `401 Unauthorized` | Token is bad or revoked. Regenerate at <https://www.notion.so/my-integrations>. |
| `object_not_found` on the database | You haven't shared the database with the integration. Open the DB, `...` → Add connections. |
| `validation_error` on status | The database's `Status` property doesn't have a value matching what bode tried to set. Run `bode setup-transitions`. |
| `property "Name" does not exist` | Your database renamed the title property. Override `notion.properties.title`. |
| Tags don't apply | `Tags` property is the wrong type. Must be `multi_select`. |

## Permissions matrix

Notion integration scopes:

- **Read content** — required
- **Update content** — required (status, tags)
- **Insert content** — required (comments)
- **No user info** — bode doesn't read user identity

Internal integrations are workspace-scoped. Public integrations (OAuth) are out of scope.

## What's missing

- **Hierarchical pages** — bode treats each task as a single database page. It doesn't create child pages for sub-tasks.
- **Rich-text comments** — bode posts plaintext, not structured Notion blocks. Code blocks and headings appear as raw markdown.
- **File attachments** — `attachFile` is a no-op.
- **Workspace-wide search** — bode addresses a single configured database. If your tasks live in multiple databases, you'd need multiple bode projects.
