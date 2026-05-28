import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '~/skills/prompt-builder.ts';
import type { JiraIssue } from '~/types/jira.ts';
import type { PromptContext } from '~/skills/prompt-builder.ts';

const SKILL = 'You are an expert planner.';

const ISSUE: JiraIssue = {
	key: 'TEST-42',
	summary: 'Implement snapshot tests',
	description: 'Add regression protection for prompt generation',
	status: 'In Progress',
	issueType: 'Task',
	assignee: 'Developer',
	labels: ['testing'],
	url: 'https://example.atlassian.net/browse/TEST-42',
};

function ctx(overrides: Partial<PromptContext> = {}): PromptContext {
	return {
		jiraIssue: ISSUE,
		projectAgentsMd: undefined,
		repoFileTree: undefined,
		priorArtifact: undefined,
		...overrides,
	};
}

function assertOrder(output: string, earlier: string, later: string): void {
	const ei = output.indexOf(earlier);
	const li = output.indexOf(later);
	assert.ok(ei >= 0, `expected "${earlier}" to appear in output`);
	assert.ok(li >= 0, `expected "${later}" to appear in output`);
	assert.ok(ei < li, `expected "${earlier}" (index ${ei}) to come before "${later}" (index ${li})`);
}

function assertAlwaysPresent(output: string): void {
	assert.ok(output.includes(SKILL));
	assert.ok(output.includes(ISSUE.key));
	assert.ok(output.includes(ISSUE.summary));
	assert.ok(output.includes('<untrusted-input-policy>'));
	assert.ok(output.includes('<untrusted-jira-ticket>'));
}

describe('buildPrompt — snapshot regression', () => {
	it('planning phase — minimal context', () => {
		const out = buildPrompt(SKILL, ctx({ phaseName: 'planning' }));
		assertAlwaysPresent(out);
		assert.ok(out.includes('<branch-context>'));
		assert.ok(out.includes('Planning phase — READ-ONLY'));
		assert.ok(!out.includes('<project-rules>'));
		assert.ok(!out.includes('<file-tree>'));
		assert.ok(!out.includes('<untrusted-prior-artifact>'));
		assert.ok(!out.includes('<bode-handoff>'));
		assertOrder(out, SKILL, '<untrusted-input-policy>');
		assertOrder(out, '<untrusted-input-policy>', '<untrusted-jira-ticket>');
		assertOrder(out, '<untrusted-jira-ticket>', '<branch-context>');
	});

	it('planning phase — with agents.md and file tree', () => {
		const agents = '# Project Rules\nUse strict TS.';
		const tree = 'src/\n  index.ts\n  utils.ts';
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'planning',
				projectAgentsMd: agents,
				repoFileTree: tree,
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('<project-rules>'));
		assert.ok(out.includes('Use strict TS'));
		assert.ok(out.includes('<file-tree>'));
		assert.ok(out.includes('utils.ts'));
		assertOrder(out, '<untrusted-jira-ticket>', '<project-rules>');
		assertOrder(out, '<project-rules>', '<file-tree>');
		assertOrder(out, '<file-tree>', '<branch-context>');
	});

	it('implementation phase — with prior artifact (planning output)', () => {
		const prior = '# Plan\n1. Create prompt builder\n2. Add snapshot tests';
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'implementation',
				priorArtifact: prior,
				baseBranch: 'main',
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('<untrusted-prior-artifact>'));
		assert.ok(out.includes(prior));
		assert.ok(out.includes('Implementation phase — CODE CHANGES EXPECTED'));
		assert.ok(out.includes('Base branch: main'));
		assertOrder(out, '<untrusted-jira-ticket>', '<untrusted-prior-artifact>');
		assertOrder(out, '<untrusted-prior-artifact>', '<branch-context>');
	});

	it('review phase — with prior artifact (implementation output)', () => {
		const prior = '## Changes Made\n- Added prompt-snapshot.test.ts';
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'review',
				priorArtifact: prior,
				currentBranch: 'chore/test-42',
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('<untrusted-prior-artifact>'));
		assert.ok(out.includes(prior));
		assert.ok(out.includes('Review phase — READ-ONLY'));
		assert.ok(out.includes('chore/test-42'));
		assertOrder(out, '<untrusted-prior-artifact>', '<branch-context>');
	});

	it('planning phase — with branch info', () => {
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'planning',
				baseBranch: 'develop',
				currentBranch: 'chore/test-42',
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('develop'));
		assert.ok(out.includes('Planning phase — READ-ONLY'));
	});

	it('implementation phase — with repos array (multi-repo)', () => {
		const repos = [
			{ workdir: '/projects/backend', name: 'backend' },
			{ workdir: '/projects/frontend', name: 'frontend' },
		];
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'implementation',
				repos,
				mainWorkdir: '/projects/backend',
				branchTool: 'git',
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('<sibling-repos>'));
		assert.ok(out.includes('/projects/backend'));
		assert.ok(out.includes('/projects/frontend'));
		assertOrder(out, '<branch-context>', '<sibling-repos>');
	});

	it('planning phase — with artifactPath (bode-handoff block)', () => {
		const artifactPath = '~/.bode/runs/TEST-42/planning.md';
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'planning',
				artifactPath,
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('<bode-handoff>'));
		assert.ok(out.includes(artifactPath));
		assertOrder(out, '<branch-context>', '<bode-handoff>');
	});

	it('implementation phase — with branchFile set', () => {
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'implementation',
				artifactPath: '~/.bode/runs/TEST-42/implementation.md',
				branchFile: '~/.bode/runs/TEST-42/branch.txt',
				baseBranch: 'main',
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('<bode-handoff>'));
		assert.ok(out.includes('~/.bode/runs/TEST-42/branch.txt'));
		assert.ok(out.includes('Write the working branch name'));
		assert.ok(out.includes('Bode reads this to track the branch'));
	});

	it('review phase — minimal context', () => {
		const out = buildPrompt(SKILL, ctx({ phaseName: 'review' }));
		assertAlwaysPresent(out);
		assert.ok(out.includes('<branch-context>'));
		assert.ok(out.includes('Review phase — READ-ONLY'));
		assert.ok(out.includes('<unknown>'));
		assert.ok(!out.includes('<project-rules>'));
		assert.ok(!out.includes('<file-tree>'));
		assert.ok(!out.includes('<untrusted-prior-artifact>'));
		assert.ok(!out.includes('<bode-handoff>'));
	});

	it('full context — everything provided', () => {
		const agents = '# Rules\nNo console.log.';
		const tree = 'src/\n  foo.ts\n  bar.ts';
		const prior = '# Prior Plan\nStep 1 done.';
		const repos = [{ workdir: '/proj/api', name: 'api' }];
		const out = buildPrompt(
			SKILL,
			ctx({
				phaseName: 'implementation',
				projectAgentsMd: agents,
				repoFileTree: tree,
				priorArtifact: prior,
				artifactPath: '~/.bode/runs/TEST-42/impl.md',
				branchFile: '~/.bode/runs/TEST-42/branch.txt',
				baseBranch: 'develop',
				currentBranch: 'chore/test-42',
				repos,
				mainWorkdir: '/proj/api',
				branchTool: 'git',
			})
		);
		assertAlwaysPresent(out);
		assert.ok(out.includes('<project-rules>'));
		assert.ok(out.includes('No console.log'));
		assert.ok(out.includes('<file-tree>'));
		assert.ok(out.includes('foo.ts'));
		assert.ok(out.includes('<untrusted-prior-artifact>'));
		assert.ok(out.includes('Prior Plan'));
		assert.ok(out.includes('<branch-context>'));
		assert.ok(out.includes('develop'));
		assert.ok(out.includes('chore/test-42'));
		assert.ok(out.includes('<sibling-repos>'));
		assert.ok(out.includes('/proj/api'));
		assert.ok(out.includes('<bode-handoff>'));
		assert.ok(out.includes('~/.bode/runs/TEST-42/impl.md'));
		assert.ok(out.includes('~/.bode/runs/TEST-42/branch.txt'));
		assertOrder(out, SKILL, '<untrusted-input-policy>');
		assertOrder(out, '<untrusted-input-policy>', '<untrusted-jira-ticket>');
		assertOrder(out, '<untrusted-jira-ticket>', '<project-rules>');
		assertOrder(out, '<project-rules>', '<file-tree>');
		assertOrder(out, '<file-tree>', '<untrusted-prior-artifact>');
		assertOrder(out, '<untrusted-prior-artifact>', '<branch-context>');
		assertOrder(out, '<branch-context>', '<sibling-repos>');
		assertOrder(out, '<sibling-repos>', '<bode-handoff>');
	});
});
