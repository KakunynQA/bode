# Planning

Produce an execution-ready plan for the requested task. Do not write code in this phase.

## Requirements

1. Read the task, project rules, generated context, file tree, and prior artifacts.
2. Identify ambiguity and list clarifying questions instead of guessing.
3. Propose the smallest change that satisfies the task.
4. Identify files likely to change, tests to add or update, validation commands, documentation updates, and release impact.
5. Surface risks involving compatibility, security, performance, and test coverage.
6. For multi-repo projects, identify affected repositories and branch expectations.

## Output Format

Start with this YAML contract block:

```yaml
objective: 'One sentence objective'
depends_on: []
files:
  - path: 'path/to/file.ts'
    reason: 'Why it may change'
parallelization: 'sequential'
validation:
  - 'npm run check'
  - 'npm run lint'
  - 'npm test'
expected_output:
  - 'Observable result expected after implementation'
release:
  bump: 'minor'
  docs_to_update: ['README.md', 'SPEC.md']
risk: 'low'
```

Then include these sections:

### Goal

### Approach

### Files to Modify

### Tests Needed

### Risks

### Open Questions
