import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __testing } from '~/orchestrator/pr-creator.ts';

const { extractPrUrl, extractPrNumber, buildPrPrompt } = __testing;

describe('extractPrUrl (github)', () => {
	it('extracts a clean GitHub PR URL', () => {
		const url = extractPrUrl('https://github.com/acme/repo/pull/42\n', 'github');
		assert.equal(url, 'https://github.com/acme/repo/pull/42');
	});

	it('finds the URL surrounded by other text', () => {
		const url = extractPrUrl(
			'PR is up: https://github.com/acme/repo/pull/7 (review when ready)',
			'github'
		);
		assert.equal(url, 'https://github.com/acme/repo/pull/7');
	});

	it('returns null when no GitHub URL present', () => {
		assert.equal(extractPrUrl('nothing here', 'github'), null);
	});
});

describe('extractPrUrl (gitlab)', () => {
	it('extracts a clean GitLab MR URL', () => {
		const url = extractPrUrl('https://gitlab.com/group/repo/-/merge_requests/9\n', 'gitlab');
		assert.equal(url, 'https://gitlab.com/group/repo/-/merge_requests/9');
	});

	it('extracts a self-hosted GitLab MR URL', () => {
		const url = extractPrUrl(
			'opened: https://gitlab.example.com/team/project/-/merge_requests/100',
			'gitlab'
		);
		assert.equal(url, 'https://gitlab.example.com/team/project/-/merge_requests/100');
	});

	it('does not match a GitHub pull URL when asked for gitlab', () => {
		assert.equal(extractPrUrl('https://github.com/acme/repo/pull/42', 'gitlab'), null);
	});
});

describe('extractPrNumber', () => {
	it('reads the trailing number from a GitHub URL', () => {
		assert.equal(extractPrNumber('https://github.com/acme/repo/pull/42', 'github'), 42);
	});
	it('reads the trailing number from a GitLab URL', () => {
		assert.equal(extractPrNumber('https://gitlab.com/g/r/-/merge_requests/100', 'gitlab'), 100);
	});
	it('returns 0 when no number is present', () => {
		assert.equal(extractPrNumber('https://github.com/no/number/here', 'github'), 0);
	});
});

describe('buildPrPrompt', () => {
	const baseArgs = {
		taskKey: 'KD-1',
		summary: 'Add hello endpoint',
		branch: 'feat/kd-1',
		baseBranch: 'main',
		workdir: '/repo',
		tool: 'gh' as const,
		createCmd: 'gh pr create ...',
		prFile: '/runs/KD-1/pr.txt',
		planning: 'PLAN',
		implementation: 'IMPL',
		review: 'REV',
	};

	it('tells the AI where to write the URL', () => {
		const out = buildPrPrompt(baseArgs);
		assert.ok(out.includes('/runs/KD-1/pr.txt'));
		assert.ok(out.includes('ONLY the PR URL'));
	});

	it('tells the AI which tool to use', () => {
		const out = buildPrPrompt(baseArgs);
		assert.ok(out.includes('Tool:         gh'));
	});

	it('inlines all three artifacts', () => {
		const out = buildPrPrompt(baseArgs);
		assert.ok(out.includes('PLAN'));
		assert.ok(out.includes('IMPL'));
		assert.ok(out.includes('REV'));
	});

	it('shows the source and target branch', () => {
		const out = buildPrPrompt(baseArgs);
		assert.ok(out.includes('Source branch: feat/kd-1'));
		assert.ok(out.includes('Target branch: main'));
	});

	it('tells the AI not to modify code', () => {
		const out = buildPrPrompt(baseArgs);
		assert.ok(out.includes('Do NOT modify code'));
	});

	it('uses glab command shape when tool is glab', () => {
		const out = buildPrPrompt({
			...baseArgs,
			tool: 'glab',
			createCmd:
				'glab mr create --source-branch X --target-branch Y --title T --description B --no-editor',
		});
		assert.ok(out.includes('Tool:         glab'));
		assert.ok(out.includes('glab mr create'));
	});
});
