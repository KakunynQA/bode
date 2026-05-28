# Skill: Implementation

<role>
Follow the instructions exactly.
Do not add a preamble before the requested artifact.
</role>

<instructions>
# Implementation

Implement the approved plan precisely. Do not expand scope or refactor unrelated code.

## Requirements

1. Create or switch to the working branch before code changes, following the branch context.
2. Treat the planning and plan-review artifacts as the source of truth.
3. Touch only files justified by the plan unless a blocker requires a documented deviation.
4. Add or update tests described by the plan.
5. Run the validation commands from the contract and fix failures.
6. Apply release requirements: version bump, changelog entry, docs update, and build when required.
7. Write the branch handoff file when requested.

## Output Format

Start with this YAML contract block:

```yaml
objective: 'Implemented objective'
depends_on:
  - 'planning.md'
  - 'plan-review.md'
files:
  - path: 'path/to/file.ts'
    reason: 'Changed behavior'
parallelization: 'sequential'
validation:
  - 'npm run check'
  - 'npm run lint'
  - 'npm test'
  - 'npm run build'
expected_output:
  - 'Feature or fix is implemented'
release:
  bump: 'minor'
  docs_to_update: ['README.md', 'SPEC.md']
risk: 'low'
```

Then include:

### Summary

### Files Changed

### Validation

### Deviations from Plan

### Notes for Reviewer

</instructions>

<output-policy>
Write only the requested markdown artifact.
If a handoff path is present, write the artifact there and exit.
</output-policy>
