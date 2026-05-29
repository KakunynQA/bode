---
command_name: bode-prompt-delegate-debug
description: Generate a scoped debugging delegation prompt for a Bode run.
---

# Bode Prompt Delegate Debug

Generate a copy-paste prompt for a separate debugging agent when a Bode execution is blocked by a failing command, test, build, runtime behavior, CI check, or environment issue.

The debugging agent must work from reproduction steps and return a concrete fix or a precise blocker report. This keeps the main execution context from looping on failed attempts.

## Task

The debugging request is: $ARGUMENTS

## Required Questions

Ask only the missing questions:

1. What task slug or plan path should this debug session attach to?
2. What command or user action reproduces the failure?
3. How many debugging attempts has the main agent already made?

Group unanswered questions in one message.

## Delegation Triggers

Delegation is mandatory when any of these apply:

- The same issue has had 3 failed fix attempts in the main Bode session.
- The failure is systemic, cross-repo, CI-only, environment-specific, or unclear after first inspection.
- The fix would require broad exploratory debugging that risks derailing the planned phase.
- The plan reviewer or phase YAML marks the failure mode as HIGH risk.

The main agent must stop debugging after the third failed attempt and create this prompt. No fourth local attempt.

## Prompt Requirements

The generated prompt must instruct the debug agent to:

- Reproduce the failure before proposing fixes whenever the environment allows.
- Inspect relevant files and command output.
- Identify root cause, not only symptoms.
- Apply or describe the smallest viable fix.
- Run the narrowest verification command that proves the fix.
- Return exact file paths, commands, and observed results.
- Escalate with a blocker report when the failure cannot be reproduced or fixed.

## Output Shape

Return a single copy-paste-ready prompt:

```markdown
---
delegation_type: debug
task: <task-slug>
bug_type: <test_failure | build_failure | lint_failure | runtime | ci | environment | other>
previous_attempts: <number>
delegation_attempt: <n>
---

# Bode Debug Delegation - <short failure name>

## Context
<what the main Bode task is and where execution is blocked>

## Reproduction
Command or steps:
1. `<command or step>`
2. `<command or step>`

Environment:
- OS: <known or unknown>
- Repo: <repo path>
- Branch: <branch>
- Relevant env vars/config: <known or none>

## Current vs Expected
- Current: <exact failure, error, or symptom>
- Expected: <passing behavior needed to continue>

## Failed Attempts
- Attempt 1: <change/command and result>
- Attempt 2: <change/command and result>
- Attempt 3: <change/command and result>

## Files and Logs to Inspect
- <path>
- <path>

## Required Output
Provide:
- Root cause.
- Minimal fix, with file paths and rationale.
- Verification commands and observed results.
- Any side effects or follow-up risks.
- If unresolved: exact blocker, what was ruled out, and next diagnostic step.

## Boundaries
- Do not broaden the product scope.
- Do not rewrite unrelated code.
- Do not use destructive git commands.
- Preserve unrelated user changes.
```

## Integration Protocol

When findings return:

1. Apply the minimal fix if it is clearly correct and within the active phase scope.
2. Run the verification command from the findings.
3. Record the delegation, root cause, fix, and result in the phase memory log when memory logging is mandatory.
4. If unresolved but the findings add a concrete new lead, re-delegate with `delegation_attempt` incremented.
5. If unresolved with no new lead, mark the phase blocked and hand over or ask the user.
