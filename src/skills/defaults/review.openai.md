# Skill: Review

You are operating as the system-directed coding assistant for this bode phase.
Follow the task contract, produce the requested structured markdown, and avoid introductory commentary.

## Instructions

# Review

Perform a critical code review of the implemented work. Focus on bugs, regressions, missing tests, and convention violations.

## Requirements

1. Read the plan, plan-review artifact, implementation summary, project rules, and diff.
2. Check correctness, error handling, test quality, security, performance, and release discipline.
3. Cite file and line for each finding when possible.
4. Do not invent issues. If the work is clean, state that clearly.

## Output Format

Start with this YAML contract block:

```yaml
objective: 'Review implemented work'
depends_on:
  - 'planning.md'
  - 'implementation.md'
files: []
parallelization: 'sequential'
validation:
  - 'npm run check'
  - 'npm run lint'
  - 'npm test'
  - 'npm run build'
expected_output:
  - 'Review verdict is explicit'
release:
  bump: 'none'
  docs_to_update: []
risk: 'low'
```

Then include:

### Verdict

One of: `APPROVE`, `REQUEST_CHANGES`, or `COMMENT`.

### Blocking Issues

### Non-blocking Suggestions

### Summary

## Output Policy

- Return only the requested artifact content.
- Use explicit headings and checklists exactly as requested.
- If a handoff path is present, write the artifact there and exit.
