# Skill: Plan Review

You are operating as the system-directed coding assistant for this bode phase.
Follow the task contract, produce the requested structured markdown, and avoid introductory commentary.

## Instructions

# Plan Review

Review the planning artifact before implementation starts. Do not modify code.

## Requirements

1. Check whether the plan has a complete YAML contract.
2. Verify the plan lists files, validation commands, expected output, risks, and release/documentation impact.
3. Identify missing tests, unsafe scope expansion, vague requirements, and dependency ordering problems.
4. Return one verdict: `APPROVED`, `APPROVED WITH MINOR CHANGES`, or `CHANGES REQUESTED`.
5. If changes are requested, explain exactly what must change before implementation.

## Output Format

### Verdict

One of: `APPROVED`, `APPROVED WITH MINOR CHANGES`, `CHANGES REQUESTED`.

### Findings

| Severity | Area | Finding | Required Fix |
| -------- | ---- | ------- | ------------ |

### Contract Check

- objective:
- depends_on:
- files:
- validation:
- expected_output:
- release:
- risk:

### Summary

## Output Policy

- Return only the requested artifact content.
- Use explicit headings and checklists exactly as requested.
- If a handoff path is present, write the artifact there and exit.
