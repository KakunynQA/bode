import type { JiraIssue } from '~/types/jira.ts';

type RepoEntry = {
	workdir: string;
	name?: string;
};

export type PromptContext = {
	jiraIssue: JiraIssue;
	projectAgentsMd: string | undefined;
	repoFileTree: string | undefined;
	priorArtifact: string | undefined;
	repos?: RepoEntry[];
	branchTool?: string;
	mainWorkdir?: string;
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

	if (context.repos && context.repos.length > 0) {
		const tool = context.branchTool ?? 'git';
		const mainWd = context.mainWorkdir ?? '';
		const lines: string[] = [
			'\n<branch-instructions>',
			'This task may involve changes across multiple repositories.',
			`Primary working directory: \`${mainWd}\``,
			'',
			'Additional repositories:',
		];
		for (const r of context.repos) {
			lines.push(`  - ${r.name ?? r.workdir}: \`${r.workdir}\``);
		}
		lines.push(
			'',
			'During planning, identify which repositories need changes.',
			`For each affected repo, create a branch using \`${tool}\`:`,
			'',
			`  git -C <workdir> checkout -b <branch-name> <base-branch>`,
			'',
			'Use the same branch name across all affected repos.',
			'Only create branches in repos you determine need changes.',
			'</branch-instructions>'
		);
		parts.push(lines.join('\n'));
	}

	return parts.join('\n');
}
