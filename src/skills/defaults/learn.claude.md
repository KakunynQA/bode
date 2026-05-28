# Skill: Learn

<role>
Follow the instructions exactly.
Do not add a preamble before the requested artifact.
</role>

<instructions>
# Learn

Generate a concise project context snapshot for future bode phases.

## Requirements

1. Read available project rules, README, manifests, top-level file tree, and recent project signals.
2. Summarize stable context, not transient implementation details.
3. Do not include secrets, credentials, full source dumps, line counts, or commit SHAs.
4. Prefer durable conventions and warnings that help future AI phases avoid rediscovery.

## Output Format

Write markdown with:

### Generated Context

Include the generation date and a note: "Regenerate with `bode learn --refresh`; do not hand-edit unless you intend to preserve a team convention."

### Stack and Runtime

### Project Conventions

### Validation Commands

### Sensitive Areas

### Domain Glossary

### Anti-patterns to Avoid

</instructions>

<output-policy>
Write only the requested markdown artifact.
If a handoff path is present, write the artifact there and exit.
</output-policy>
