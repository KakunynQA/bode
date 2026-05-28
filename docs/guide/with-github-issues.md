# Workflow — With GitHub Issues

## Setup

The GitHub Issues adapter reuses your `gh` CLI auth — no separate token needed.

```bash
gh auth status        # verify you're logged in
# if not:
gh auth login

bode setup            # pick "GitHub Issues" when asked which tracker
```

Result in `~/.bode/config.yml`:

```yaml
tracker: github-issues

vcs:
  provider: github

github:
  default_org: myorg
```

That's it. No token to manage in config.

## Daily flow

```bash
bode 123              # fetch issue #123 from the current repo's GitHub remote
# review the plan that landed as an issue comment
bode continue 123     # implementation
bode continue 123     # review
bode continue 123     # creates PR, links it to the issue (via "Closes #123" in PR body)
# someone reviews the PR
bode done 123         # back to base, closes the issue
```

You can also reference cross-repo issues:

```bash
bode owner/repo#456
```

## Status mapping

GitHub Issues only have `open` and `closed` states. bode encodes phase via labels:

| bode phase | GitHub state | Label |
|---|---|---|
| planning | open | `bode:planning` |
| implementing | open | `bode:implementing` |
| reviewing | open | `bode:reviewing` |
| awaiting-merge | open | `bode:awaiting-merge` |
| done | **closed** | (none — labels removed) |

Labels are created in the repo on first use if they don't exist.

## Branch naming

GitHub Issues don't have explicit "issue types" the way Jira does. bode infers the prefix from labels:

| Label present | Branch prefix |
|---|---|
| `bug` | `fix/` |
| `enhancement` / `feature` | `feat/` |
| `refactor` | `refactor/` |
| `chore` / `documentation` | `chore/` |
| (anything else) | `feat/` |

Example: issue #123 labeled `bug` → branch `fix/123`.

## PR-issue linking

The implementation phase tells the AI to put `Closes #<number>` in the PR body. GitHub auto-closes the issue when the PR merges, and bode's `done` step is what flips the state in the tracker — both paths converge to "issue closed".

## Failure modes

| Symptom | Likely cause |
|---|---|
| `gh: command not found` | Install `gh` CLI: <https://cli.github.com/> |
| `gh auth status` shows you're logged out | `gh auth login` |
| `Could not resolve remote` | You're running bode in a repo that doesn't have a GitHub remote (or `gh` can't see it). |
| Comments aren't posting | Your `gh` token may lack `repo` scope. Re-run `gh auth login` and grant the scope when prompted. |

For deeper details, see [Trackers → GitHub Issues](/trackers/github-issues).
