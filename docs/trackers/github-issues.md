# Trackers — GitHub Issues

Lives at `src/adapters/tracker/github-issues.ts`. Reuses your existing `gh` CLI auth — no separate token to manage.

## Auth

```bash
gh auth login
```

…and you're done. bode shells out to `gh` for every call (issue fetch, comment, label, close). If `gh auth status` works, this adapter works.

```yaml
tracker: github-issues

vcs:
  provider: github

github:
  default_org: myorg     # optional
```

## Task keys

Three formats accepted:

- `123` — issue #123 in the current repo (resolved from `git remote`)
- `owner/repo#123` — issue from any repo your `gh` token can see
- A full GitHub issue URL — `https://github.com/owner/repo/issues/123`

## Status mapping

GitHub Issues are only `open` / `closed`. bode encodes phase via labels:

| bode phase | GitHub state | Label applied |
|---|---|---|
| planning | open | `bode:planning` |
| planned | open | `bode:planned` |
| implementing | open | `bode:implementing` |
| reviewing | open | `bode:reviewing` |
| awaiting-merge | open | `bode:awaiting-merge` |
| done | **closed** | (all `bode:*` labels removed) |

`setStatus(key, 'done')` closes the issue (`gh issue close`). Any other transition is recorded as a label-only state change.

Labels are auto-created in the repo on first use if they don't exist (the underlying `gh issue edit --add-label` does this).

## Branch naming

GitHub Issues don't have a typed "issue type" the way Jira does. bode infers from labels:

| Label present | Branch prefix |
|---|---|
| `bug` | `fix/` |
| `enhancement`, `feature` | `feat/` |
| `refactor` | `refactor/` |
| `chore`, `documentation` | `chore/` |
| (anything else) | `feat/` |

`inferIssueType` (exported as `__testing` for unit tests) is the resolver.

## Comments

`postComment(key, body)` runs `gh issue comment <number> --body <markdown>`. GitHub renders the markdown natively — no transformation needed.

Long artifacts are truncated at `comment_format.plan_inline_max_chars`.

## PR-issue linking

bode tells the AI (via the bundled implementation skill) to include `Closes #<number>` in the PR body. GitHub then auto-closes the issue when the PR merges. bode's own `bode done` step is a safety net that closes the issue if for some reason GitHub didn't.

## Cross-repo work

If your task is in one repo but the PR goes to another (rare but happens), pass the full `owner/repo#number` form:

```bash
bode upstream-org/upstream-repo#456
```

bode fetches the issue from `upstream-org/upstream-repo`, creates the branch and PR in the **current** repo, and comments back on the upstream issue with the PR URL.

## API contract

| Method | gh command |
|---|---|
| `fetchTask(key)` | `gh issue view <number> --json title,body,labels,state,assignees,url` |
| `postComment(key, body)` | `gh issue comment <number> --body <body>` |
| `setStatus(key, name)` | label edit + `gh issue close` when `name === "done"` |
| `addTag(key, tag)` / `removeTag(key, tag)` | `gh issue edit <number> --add-label / --remove-label` |
| `listStatuses(key)` | returns a static list (`planning`, `implementing`, `reviewing`, `awaiting-merge`, `done`) |
| `attachFile(...)` | no-op (GitHub doesn't support issue attachments via API) |

## Permissions matrix

The `gh` token needs:

- `repo` scope (read issues, post comments, edit labels, close issues)

If `gh auth login` was run with a more limited token, run `gh auth refresh -s repo` to broaden it.

## Failure modes

| Symptom | Likely cause |
|---|---|
| `gh: command not found` | Install `gh` CLI. See <https://cli.github.com/>. |
| `gh auth status` says logged out | `gh auth login` |
| Comments don't post | Token lacks `repo` scope. `gh auth refresh -s repo`. |
| `Could not resolve to a Repository` | Running bode in a repo with no GitHub remote, or `gh` can't see it. |
| Issue not found | Wrong key or no access. Try `gh issue view <number>` directly to confirm. |

## What's missing

- **GraphQL bulk operations** — bode shells out to `gh` per call, which means a planning phase that touches several labels could be 3–4 sequential CLI invocations. Fine for normal use; would matter for bulk imports.
- **GitHub Projects (v2) integration** — bode doesn't write to GitHub Projects boards. It only touches the issue itself.
- **Reactions / linked PRs API** — bode doesn't read PR reactions or use the linked-PR sidebar API. The `Closes #N` convention is enough.
