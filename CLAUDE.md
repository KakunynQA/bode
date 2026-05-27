# CLAUDE.md

Entry point for Claude (Claude Code, Claude in OpenCode, or any other interface) when working on this repository.

## Read These First

Before any task, read these files in order:

1. **`AGENTS.md`** — Workflow rules, validation commands, forbidden actions, definition of done. Source of truth for how to operate in this repo.
2. **`CONVENTIONS.md`** — Code style and standards. All code you produce must conform.
3. **`SPEC.md`** — Product specification. Read the sections relevant to your task.

## Claude-Specific Notes

Everything in `AGENTS.md` applies. These notes reinforce, not override.

### Plan Before Build

For any non-trivial task, use plan mode first. Output the plan, wait for human approval, then execute. Non-trivial = anything that:
- Touches more than 3 files
- Adds or changes a CLI command
- Adds a new CliAdapter or modifies the Jira adapter
- Changes the phase orchestration logic
- Modifies config schema or skill resolution

### Context Management

- Don't load the whole repo. Use `glob` and `grep` to find what you need.
- Cite the files you read in your reasoning, briefly.
- If you need to read more than ~10 files for a single task, stop and ask if the task is too broad.

### Sub-tasks

- When delegating to a sub-agent (research, parallel branch), summarize result back in main thread. Don't bury findings.
- One feature = one PR. Don't bundle.

### Validation Discipline

Run the full validation chain (see `AGENTS.md` → Commands) before claiming a task is done. "This should work" without running validation is not acceptable.

### When You Disagree

If a request conflicts with `AGENTS.md`, `CONVENTIONS.md`, or `SPEC.md`, say so. Cite the conflicting rule. Ask which wins. Do not silently violate.

## Quick Reference

- Stack: TypeScript strict, Node.js + esbuild, no DB (filesystem `~/.bode/`), MCP Atlassian for Jira, child_process for AI CLIs
- Runtime: Node.js >=18, CJS bundle via esbuild
- Run dev: `npm run dev -- <subcommand>`
- Validate: `npm run check; npm run lint; npm run build`
- Install globally: `npm run build && npm pack && npm i -g bode-*.tgz`
- Never: `any`, direct Jira REST, direct git CLI outside `adapters/vcs/`
- ASCII art: `src/assets/bode.art` → embedded via esbuild `define` as `__GOAT_ART__`
- Models registry: `src/adapters/cli/models.ts` — update when new models launch
- Adapter registry: `src/adapters/cli/registry.ts` — update when adding new CLI
