# Phases

bode breaks AI work into discrete phases. Each phase is one AI session, with the prior phase's artifact in context.

## The four phases

```
planning  →  implementation  →  review  →  pr
```

| Phase | Purpose | Configured by | Artifact |
|---|---|---|---|
| `planning` | Read the ticket, produce a plan | `phases.planning` + `planning.md` skill | `~/.bode/runs/<KEY>/planning.md` |
| `implementation` | Execute the plan, commit code | `phases.implementation` + `implementation.md` skill | `~/.bode/runs/<KEY>/implementation.md` |
| `review` | Self-review the diff | `phases.review` + `review.md` skill | `~/.bode/runs/<KEY>/review.md` |
| `pr` | Conflict check, create PR | n/a (AI does it via `gh`/`glab`) | `~/.bode/runs/<KEY>/pr.txt` |

The `pr` phase doesn't have a skill — the AI runs `gh pr create` (or `glab mr create`) using the implementation + review artifacts as the PR body.

## How a phase runs

For each phase, bode (in `src/orchestrator/phase-runner.ts`):

1. **Preflight** — verifies `workdir`, `context_paths[]`, and `repos[].workdir` are readable. If not, aborts before spending tokens.
2. **Pre-hooks** — runs `pre_<phase>` commands from your config. Non-zero exit aborts unless `non_blocking: true`.
3. **Tracker transition** — moves the ticket to the configured status.
4. **"Starting" comment** — posts to the tracker.
5. **Build prompt** — combines the skill template, ticket body (wrapped in `<untrusted>` markers), project context files (`AGENTS.md`, `CLAUDE.md`, etc.), repo file tree, prior artifacts, and a `<bode-handoff>` block telling the AI where to write the final artifact.
6. **Hand off the terminal** — invokes the configured AI CLI with `stdio: 'inherit'`. You see the live session and approve tool calls in the CLI's own native UI.
7. **Read the artifact** — when the AI exits, bode reads `<phase>.md`. Missing or empty? Interactive prompt `[retry | continue | abort]`.
8. **Exit-code gate** — non-zero exit from the AI CLI marks the phase failed regardless of artifact presence.
9. **Post-hooks** — runs `post_<phase>` commands.
10. **Summary comment** — posts the artifact (truncated at `plan_inline_max_chars`, default 3000) to the tracker.
11. **Atomic meta update** — writes `~/.bode/runs/<KEY>/meta.json` via temp file + rename.

## Configuring a phase

```yaml
phases:
  planning:
    cli: claude-code
    model: claude-opus-4-7
    skill: ~/.bode/skills/planning.md   # optional
    timeout_minutes: 15
```

| Key | Purpose |
|---|---|
| `cli` | Which AI CLI adapter. `claude-code`, `opencode`, or `codex`. |
| `model` | Model identifier. Must be in the registry at `src/adapters/cli/models.ts`. |
| `skill` | Optional explicit skill path. If omitted, bode uses `<repo>/.bode/skills/<phase>.md` → `~/.bode/skills/<phase>.md` → bundled default. |
| `timeout_minutes` | Hard limit. 1 to 480 minutes. Defaults: 15 / 60 / 10. |

## Picking a model

Each phase has a different cognitive load:

- **Planning** — wants strong reasoning. Use `claude-opus-4-7` if you can afford it.
- **Implementation** — wants speed and reliability. `claude-sonnet-4-6` or `claude-haiku-4-5` work well.
- **Review** — wants critical thinking. `claude-sonnet-4-6` or `claude-opus-4-7`.

See `src/adapters/cli/models.ts` for the full registry. Adding a new model is one line.

## Auto mode

```bash
bode start KD-312 --auto
```

Runs planning → implementation → review → pr in sequence. Each phase still runs as an AI session, but bode does not wait for human input between them. AI sessions switch to **headless** mode (`--print` / `run` / `exec`) when `--auto` is on so unattended runs work.

`--dangerously-auto-merge` adds: + `gh pr merge` + `bode done`.

`--dangerously-approve-all` passes each CLI's bypass-approvals flag (claude: `--dangerously-skip-permissions`, codex: `--dangerously-bypass-approvals-and-sandbox`). For opencode (no equivalent), bode warns upfront.

## Conflict detection

Before the `pr` phase, bode fetches latest from origin and checks if the base branch is an ancestor of the task branch:

- ✅ Ancestor → proceeds to PR creation.
- ❌ Not ancestor → marks `conflict: true` in meta, adds `bode:conflict` label/tag in tracker, warns the developer. You resolve manually, then `bode continue`.

## Customizing phase output

The artifact format is determined entirely by the skill prompt. Copy a bundled skill to `~/.bode/skills/<phase>.md` and edit it. See [Reference → Skills](/reference/skills).

Common customizations:

- Strict markdown headers expected by your team's templates
- Specific section order ("Risks before Approach")
- Forbidden content ("never use emoji")
- Required tooling calls ("always run `npm run lint` before reporting done")

## Re-running a phase

If a phase produced a bad artifact:

```bash
bode abort KD-312
bode start KD-312
```

`abort` cleans up the branch, removes labels, and clears the local run. `start` re-runs from planning.

To re-run only the current phase without restarting, you can also `bode continue KD-312` and answer `retry` when prompted for the missing artifact.
