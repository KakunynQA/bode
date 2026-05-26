import type { JiraIssue } from '~/types/jira.ts';

export type PromptContext = {
  jiraIssue: JiraIssue;
  projectAgentsMd: string | undefined;
  repoFileTree: string | undefined;
  priorArtifact: string | undefined;
};

export function buildPrompt(skillContent: string, context: PromptContext): string {
  const parts: string[] = [skillContent];

  parts.push('\n## Context\n');

  parts.push(`<jira-ticket>
Title: ${context.jiraIssue.summary}
Key: ${context.jiraIssue.key}
Status: ${context.jiraIssue.status}
Description:
${context.jiraIssue.description}
</jira-ticket>`);

  if (context.projectAgentsMd) {
    parts.push(`\n<project-rules>\n${context.projectAgentsMd}\n</project-rules>`);
  }

  if (context.repoFileTree) {
    parts.push(`\n<file-tree>\n${context.repoFileTree}\n</file-tree>`);
  }

  if (context.priorArtifact) {
    parts.push(`\n<prior-artifact>\n${context.priorArtifact}\n</prior-artifact>`);
  }

  return parts.join('\n');
}
