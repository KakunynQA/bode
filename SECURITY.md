# Security

Bode is a local CLI. It reads your repository, tracker task, config, and skill prompts, then sends the assembled phase prompt only to the AI CLI you configured.

## What Bode Reads

- Repository context: `AGENTS.md`, `CLAUDE.md`, `.bode/context.md`, configured `context_paths`, and file tree summaries.
- Task content from the configured tracker or local `.bode/tasks/*.md`.
- Local config from `~/.bode/config.yml`, project configs, and `.bode.yml`.
- Skill prompts from bundled defaults, `~/.bode/skills/`, or `<repo>/.bode/skills/`.

## What Bode Writes

- Run artifacts under `~/.bode/runs/<KEY>/`, including logs, phase artifacts, saved prompts, and `manifest.json`.
- Optional local telemetry under `~/.bode/telemetry/events.ndjson` only after `bode telemetry on`.
- Optional usage/cost files under `~/.bode/usage/`.
- Optional doctor reports when you run `bode doctor --report`.

## What Leaves Your Machine

- Prompts and context are sent to the AI CLI provider you configured for the phase.
- Tracker operations go only through the configured tracker adapter.
- VCS operations go only through `gh` or `glab` where supported.
- `bode feedback` only opens or prints a pre-filled GitHub issue URL. Nothing is submitted until you review and submit it yourself.
- Telemetry has no default endpoint and does not leave the machine unless you explicitly configure one.

## Untrusted Content

Task bodies, comments, prior artifacts, and repository-derived context are treated as untrusted data in generated prompts. Bode wraps them in `<untrusted-*>` blocks and instructs AI CLIs to ignore instructions that try to bypass validation, leak secrets, change artifact paths, or operate outside configured workdirs.

## Secret Handling

- Do not commit `~/.bode/config.yml`, `.env`, tracker tokens, AI provider keys, or generated reports containing private data.
- Bode should not log raw credentials. If you find a token in a Bode log or artifact, treat it as a bug and rotate the token.
- Review `bode doctor --report` output before sharing it publicly.

## Reporting Vulnerabilities

Open a GitHub issue with a minimal reproduction if it can be shared safely. If the report contains secrets, private repository details, or exploitable instructions, contact the maintainers privately before posting public details.
