# Trackers — Trello

Lives at `src/adapters/tracker/trello.ts`. Cards are tasks, lists are statuses, labels are tags.

## Auth

1. Get your **API key** and **token** at <https://trello.com/app-key>
2. The page shows your API key immediately; click the **Token** link to generate a token (it lasts forever unless you revoke it)

Prefer env vars:

```bash
export TRELLO_KEY="xxx"
export TRELLO_TOKEN="xxx"
```

Or YAML:

```yaml
tracker: trello
trello:
  api_key: xxx
  token: xxx
  board_id: xxx          # optional — pins bode to one board
```

Without `board_id`, bode resolves the board from each card on every call (one extra request per task lookup).

## Task keys

Two accepted forms:

- **Card ID** — the 24-char hex ID from the API (`5f8a3b...`)
- **Short link** — the 8-char code in the card URL (`https://trello.com/c/<SHORTLINK>/...`)

Short links are easier — you can copy them straight from the browser.

## Status mapping

Trello cards live in **lists** on a **board**. bode maps phases to list names. `setStatus(card, name)` moves the card to the list whose name matches.

Default mapping:

| bode phase | Trello list name (default) |
|---|---|
| planning | "In Progress" |
| implementation | "In Review" |
| review | "Code Review" |
| awaiting_merge | "Awaiting Merge" |
| done | "Done" |

Lists must exist on the board — bode does NOT auto-create them. If a list is missing, the status transition is logged as a warning and skipped (the task continues).

Run `bode setup-transitions` to see your board's actual list names and map.

## Labels

Trello cards have colored labels. bode uses label **names**. `addTag(card, "bode:planning")` finds a label by name on the card's board and adds it.

Important: labels must exist on the board (created in Trello's UI). bode does NOT auto-create.

## Comments

`postComment(card, body)` posts a Trello card comment. Trello renders a subset of markdown (bold, italic, code, lists, links). Headings come through as plain text.

Truncation at `comment_format.plan_inline_max_chars`.

## Branch naming

Trello cards have no built-in "type" field. bode inspects labels:

| Label present | Branch prefix |
|---|---|
| `bug` | `fix/` |
| `feature`, `enhancement` | `feat/` |
| `refactor` | `refactor/` |
| `chore` | `chore/` |
| (anything else) | `feat/` |

## API contract

REST endpoint: `https://api.trello.com/1`. Auth via query string (`?key=<key>&token=<token>`).

| Method | Trello endpoint |
|---|---|
| `fetchTask(key)` | `GET /cards/{id}?fields=...&list=true&labels=true&members=true` |
| `postComment(key, body)` | `POST /cards/{id}/actions/comments` |
| `setStatus(key, name)` | resolves list ID by name on the card's board + `PUT /cards/{id}` with `idList` |
| `addTag(key, tag)` / `removeTag(key, tag)` | resolves label ID + `POST/DELETE /cards/{id}/idLabels/{labelId}` |
| `listStatuses(key)` | `GET /boards/{boardId}/lists` |
| `attachFile(key, path)` | `POST /cards/{id}/attachments` (supported) |

Every call has a 30 s timeout.

## Failure modes

| Symptom | Likely cause |
|---|---|
| `401 invalid key` | Wrong API key. Get it at <https://trello.com/app-key>. |
| `401 invalid token` | Token revoked or expired. Generate a new one. |
| `Card not found` | Wrong card ID / shortlink, or your token doesn't have access to the board. |
| `List "In Review" not found` | List doesn't exist on the board. Create it or run `bode setup-transitions`. |
| `Label "bode:planning" not found` | Label doesn't exist on the board. Create it in Trello first. |

## Permissions matrix

The token's user needs:

- Read access to the board
- Write access (move cards, add labels, post comments)

For team-wide use, generate a token under a dedicated bot account or a service user.

## What's missing

- **Power-Ups** — bode doesn't interact with Power-Ups (custom fields, automation).
- **Checklists** — bode doesn't read or write card checklists. Plans live in comments, not checklists.
- **Members assignment** — bode doesn't assign card members automatically.
- **Calendar / dates** — bode doesn't touch due dates.

These are conscious omissions to keep the adapter to a single file with no SDK dependency.
