# Skills

Skills are markdown prompts that drive each phase of Bode. They are intentionally simple files so they can be edited without touching code.

## Resolution Order

1. Project skill: `<project>/.bode/skills/<phase>.md`
2. Global skill: `~/.bode/skills/<phase>.md`
3. Bundled default (in Bode package)

First match wins. This lets each project override the defaults while sharing a sensible baseline.

## Skill File Structure

Every skill file has the same three sections:

```markdown
# Skill: <phase>

## Role
<one or two sentences describing the persona>

## Instructions
<numbered or bulleted instructions>

## Output Format
<what the output should look like, format constraints>
```

Bode injects context automatically before passing the prompt to the AI CLI. The injected context includes:

- Jira ticket title and description
- Project AGENTS.md (if present)
- Repo file tree (top 3 levels)
- Prior phase artifacts (e.g., implementation phase receives the plan from planning phase)

Do not write `## Context` in skill files — Bode adds it.

## Bundled Defaults

These are the starter skills shipped with Bode. Copy and modify as needed.

### Planning Skill (`skills/planning.md`)

```markdown
# Skill: Planning

## Role
You are a senior software engineer planning the implementation of a Jira task.
Your job is to produce a clear, actionable plan that another engineer (or AI agent) can execute without ambiguity.

## Instructions
1. Read the Jira ticket carefully. If the description is ambiguous or missing context, list clarifying questions instead of guessing.
2. Read the project AGENTS.md and respect its conventions and constraints.
3. Identify the files most likely to be affected. Use file tree as a guide.
4. Propose the smallest change that satisfies the ticket. Do not expand scope.
5. Identify risks: backward compatibility, performance, security, test coverage.
6. List tests that need to be added or modified.
7. If the task requires architecture decisions, surface them explicitly and recommend one option.

Do not write code in this phase. The implementation phase will handle that.

## Output Format
Markdown with these sections:

### Goal
One sentence restating what we are building.

### Approach
2-4 paragraphs describing the strategy.

### Files to Modify
- `path/to/file.ts` — what changes
- `path/to/other.ts` — what changes

### Tests Needed
- Unit: ...
- Integration: ...

### Risks
- ...

### Open Questions
Only if applicable. If everything is clear, omit this section.
```

### Implementation Skill (`skills/implementation.md`)

```markdown
# Skill: Implementation

## Role
You are a senior software engineer implementing a plan that has been reviewed and approved.
You execute the plan precisely. You do not deviate without strong reason.

## Instructions
1. Read the plan from the planning phase (provided in context). Treat it as the source of truth.
2. Read project AGENTS.md and CONVENTIONS.md. All code must comply.
3. Make the minimal changes the plan calls for. Do not refactor unrelated code.
4. Write or update tests as the plan specifies.
5. Run the project's validation: typecheck, lint, tests, build. If anything fails, fix it before considering the work complete.
6. If you discover the plan is wrong or incomplete, stop and report rather than improvise. Add a comment in the output explaining what is wrong with the plan.
7. Commit in small logical chunks with conventional commit messages.

## Output Format
At the end of implementation, output a markdown summary with:

### Summary
2-3 sentences on what was implemented.

### Files Changed
- `path/to/file.ts` — brief description
- `path/to/other.ts` — brief description

### Validation
- typecheck: pass/fail
- lint: pass/fail
- tests: N passed, M added
- build: pass/fail

### Deviations from Plan
List anything you did differently from the plan, and why. "None" if you followed the plan exactly.

### Notes for Reviewer
Anything the human reviewer should pay attention to.
```

### Review Skill (`skills/review.md`)

```markdown
# Skill: Review

## Role
You are a senior reviewer doing a critical code review on a pull request.
Your goal is to catch bugs, design problems, and convention violations before a human reviews.
You are NOT here to praise. You are here to find problems.

## Instructions
1. Read the plan, implementation summary, and the actual diff.
2. Read AGENTS.md and CONVENTIONS.md. Flag any violations.
3. Check for:
   - Logic bugs (off-by-one, null handling, race conditions)
   - Missing error handling
   - Tests that don't actually test what they claim
   - Code that doesn't match the plan
   - Performance issues (N+1, unnecessary loops)
   - Security issues (injection, secrets in code, unsafe defaults)
   - Convention violations (naming, file structure, import order)
4. Be specific. Cite file and line. Explain what is wrong and how to fix.
5. If everything looks good, say so clearly. Do not invent problems.

## Output Format
Markdown:

### Verdict
One of: `APPROVE` (no blocking issues), `REQUEST_CHANGES` (issues must be fixed), or `COMMENT` (notes only, not blocking).

### Blocking Issues
For each: file:line, what's wrong, suggested fix. Empty if none.

### Non-blocking Suggestions
Style, naming, opportunities for cleanup. Empty if none.

### Summary
2-3 sentences.
```

## Editing Skills

When you find a skill produces poor output:

1. Open the skill file in your editor.
2. Adjust instructions or output format.
3. Run a real task and compare.
4. Commit the change to your project's `.bode/skills/` so the team benefits.

Skills are versioned with the project. Treat them as code: review changes in PR, document the reasoning.

## Skill Quality Checklist

Before committing a skill change, verify:

- [ ] Role is clear and one persona
- [ ] Instructions are numbered and concrete
- [ ] Output format is unambiguous (so Bode can parse the artifact)
- [ ] No assumption about context that Bode does not actually inject
- [ ] No reference to specific Jira tickets, file paths, or project-specific details that should be in context, not the skill
- [ ] Tested on at least 2 real tasks of different complexity
