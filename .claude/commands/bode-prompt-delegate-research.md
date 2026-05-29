---
command_name: bode-prompt-delegate-research
description: Generate a scoped research delegation prompt for a Bode run.
---

# Bode Prompt Delegate Research

Generate a copy-paste prompt for a separate research agent when a Bode execution needs current external information, official documentation, compatibility data, API behavior, migration guidance, or practice comparison.

Use this instead of letting the main execution context absorb broad research. The goal is context isolation: the research agent returns only the information needed to unblock the plan or implementation.

## Task

The research request is: $ARGUMENTS

## Required Questions

Ask only the missing questions:

1. What task slug or plan path should this research attach to?
2. What exact decision will the research unblock?
3. Should the research be limited to official/primary sources only? Default: yes.

Group unanswered questions in one message.

## Delegation Triggers

Create a research delegation when any of these apply:

- The answer depends on current docs, SDK behavior, product capabilities, pricing, limits, or deployment rules.
- The main agent has conflicting or stale knowledge.
- The plan reviewer finds a missing compatibility or migration assumption.
- A phase has HIGH risk because external behavior is unknown.
- The research spans multiple sources and would pollute implementation context.

Do not delegate if the needed answer is already present in repo docs, code, or local command output.

## Prompt Requirements

The generated prompt must instruct the research agent to:

- Use current sources, preferably official documentation, official GitHub repositories, release notes, standards, or vendor docs.
- Provide source links for every material claim.
- Quote sparingly and summarize in its own words.
- Separate facts from recommendations.
- Call out uncertainty, version/date sensitivity, and assumptions.
- Return a concise integration section explaining how the main Bode agent should apply the findings.
- Avoid implementation unless explicitly asked.

## Output Shape

Return a single copy-paste-ready prompt:

```markdown
---
delegation_type: research
task: <task-slug>
decision_to_unblock: <decision>
source_policy: <official_only | credible_sources_allowed>
delegation_attempt: <n>
---

# Bode Research Delegation - <topic>

## Context
<what the main task is and why this research matters>

## Research Questions
1. <specific question>
2. <specific question>

## Source Requirements
- Prefer official documentation, official repositories, standards, or vendor release notes.
- Use credible secondary sources only when official sources are unavailable or insufficient.
- Include links for all sources used.

## Required Output
Provide:
- Answer summary.
- Source-backed facts.
- Practical recommendation for the main Bode workflow.
- Risks, unknowns, and version/date sensitivity.
- Integration notes: exact files, plan sections, validation commands, or prompt rules that should change.

## Boundaries
- Do not edit files.
- Do not run destructive commands.
- Do not broaden the task beyond the research questions.
```

## Integration Protocol

When findings return:

1. Validate that source links are present and relevant.
2. Update the active plan or implementation notes with only the actionable findings.
3. Record the delegation in the phase memory log when memory logging is mandatory.
4. If findings are incomplete, create a second delegation with `delegation_attempt` incremented and include what was missing.
