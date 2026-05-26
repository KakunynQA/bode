# CLAUDE.md

This file is the entry point for Claude (Claude Code, Claude in OpenCode, or any other interface) when working on this repository.

## Read These First

Before any task, read these files in order:

1. **`AGENTS.md`** — Workflow rules, validation commands, forbidden actions, definition of done. This is the source of truth for how to operate in this repo.
2. **`CONVENTIONS.md`** — Code style and standards. All code you produce must conform.
3. **`SPEC.md`** — Product specification. Read the sections relevant to your task.

## Claude-Specific Notes

Everything in `AGENTS.md` applies. The notes below are Claude-specific reinforcements, not overrides.

### Plan Before Build

For any non-trivial task, use plan mode first. Output the plan, wait for human approval, then execute. A non-trivial task is anything that:
- Touches more than 3 files
- Adds a new feature or fixes a non-obvious bug
- Changes the data model or migration set
- Involves third-party API integration

### Context Management

- Don't load the whole repo. Use `glob` and `grep` to find what you need.
- Cite the files you read in your reasoning, briefly.
- If you find yourself needing to read more than ~10 files for a single task, stop and ask whether the task is too broad.

### Sub-tasks

- When you delegate to a sub-agent (e.g., for research or for a parallel branch), summarize the result back in the main thread. Don't leave findings buried.
- One feature = one PR. Don't bundle.

### Validation Discipline

You must run the full validation chain (see `AGENTS.md` → Commands) before claiming a task is done. Reporting "this should work" without running validation is not acceptable.

### When You Disagree

If a request conflicts with `AGENTS.md` or `CONVENTIONS.md`, say so. Cite the conflicting rule. Ask which one wins. Do not silently violate the standards.

## Quick Reference

- Stack: SvelteKit 2 SPA, Svelte 5 runes, TypeScript strict, Tailwind, Bun, SQLite via `bun:sqlite`, `@opencode-ai/sdk`, Playwright
- Run: `bun run dev`
- Validate: `bun run check && bun run lint && bun run test && bun run test:e2e && bun run build`
- Never: `any` in TypeScript, raw SQL outside `src/lib/db/queries/`, direct `main` pushes, applied migration edits
