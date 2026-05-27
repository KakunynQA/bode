import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeCodeAdapter } from '~/adapters/cli/claude-code.ts';
import { CodexAdapter } from '~/adapters/cli/codex.ts';
import { OpenCodeAdapter } from '~/adapters/cli/opencode.ts';

describe('dangerousFlags()', () => {
	it('claude-code returns --dangerously-skip-permissions', () => {
		assert.deepEqual(new ClaudeCodeAdapter().dangerousFlags(), ['--dangerously-skip-permissions']);
	});

	it('codex returns --dangerously-bypass-approvals-and-sandbox', () => {
		assert.deepEqual(new CodexAdapter().dangerousFlags(), [
			'--dangerously-bypass-approvals-and-sandbox',
		]);
	});

	it('opencode returns null (no equivalent flag)', () => {
		assert.equal(new OpenCodeAdapter().dangerousFlags(), null);
	});
});

describe('buildArgs() — interactive vs headless', () => {
	const cfg = { cli: 'x', model: 'm', timeout_minutes: 1 };

	it('claude headless includes --print, no prompt as arg', () => {
		const args = new ClaudeCodeAdapter().buildArgs('PROMPT', cfg, {});
		assert.ok(args.includes('--print'));
		assert.ok(!args.includes('PROMPT'));
	});

	it('claude interactive omits --print and passes prompt positionally', () => {
		const args = new ClaudeCodeAdapter().buildArgs('PROMPT', cfg, { interactive: true });
		assert.ok(!args.includes('--print'));
		assert.ok(args.includes('PROMPT'));
	});

	it('claude with dangerousBypass injects --dangerously-skip-permissions', () => {
		const args = new ClaudeCodeAdapter().buildArgs('P', cfg, {
			interactive: true,
			dangerousBypass: true,
		});
		assert.ok(args.includes('--dangerously-skip-permissions'));
	});

	it('codex with dangerousBypass injects --dangerously-bypass-approvals-and-sandbox', () => {
		const args = new CodexAdapter().buildArgs('P', cfg, {
			interactive: true,
			dangerousBypass: true,
		});
		assert.ok(args.includes('--dangerously-bypass-approvals-and-sandbox'));
	});

	it('opencode ignores dangerousBypass (no flag exists)', () => {
		const args = new OpenCodeAdapter().buildArgs('P', cfg, {
			interactive: true,
			dangerousBypass: true,
		});
		assert.ok(!args.some((a) => a.startsWith('--dangerously')));
	});
});
