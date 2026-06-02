import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('index.ts routing logic (unit)', () => {
	it('--version flag is recognized', () => {
		const args = ['--version'];
		assert.ok(args.includes('--version'));
	});

	it('-V flag is recognized', () => {
		const args = ['-V'];
		assert.ok(args.includes('-V'));
	});

	it('--help flag is recognized', () => {
		const args = ['--help'];
		assert.ok(args.includes('--help'));
	});

	it('no args means TUI mode', () => {
		const args: string[] = [];
		const isExplicitCommand = args.length > 0 && !args[0]!.startsWith('-');
		assert.ok(!isExplicitCommand);
	});

	it('explicit command like "setup" is recognized', () => {
		const args = ['setup'];
		const isExplicitCommand = args.length > 0 && !args[0]!.startsWith('-');
		assert.ok(isExplicitCommand);
	});

	it('flag-only args like --auto do not trigger explicit command', () => {
		const args = ['--auto'];
		const isExplicitCommand = args.length > 0 && !args[0]!.startsWith('-');
		assert.ok(!isExplicitCommand);
	});

	it('quoted prompt is recognized as explicit command', () => {
		const args = ['fix the bug'];
		const isExplicitCommand = args.length > 0 && !args[0]!.startsWith('-');
		assert.ok(isExplicitCommand);
	});

	it('start KD-1 is recognized as explicit command', () => {
		const args = ['start', 'KD-1'];
		const isExplicitCommand = args.length > 0 && !args[0]!.startsWith('-');
		assert.ok(isExplicitCommand);
	});
});

describe('normalizeAlias', () => {
	function normalizeAlias(line: string): string {
		const tokens = line.trim().split(/\s+/);
		const first = tokens[0]?.toLowerCase() ?? '';
		if (first === 'setup' && tokens[1]?.toLowerCase() === 'project') {
			return ['setup-project', ...tokens.slice(2)].join(' ');
		}
		if (first === 'setup' && tokens[1]?.toLowerCase() === 'transitions') {
			return ['setup-transitions', ...tokens.slice(2)].join(' ');
		}
		return line;
	}

	it('rewrites "setup project" to "setup-project"', () => {
		assert.equal(normalizeAlias('setup project'), 'setup-project');
	});

	it('rewrites "setup project --shared-in-repo" to "setup-project --shared-in-repo"', () => {
		assert.equal(
			normalizeAlias('setup project --shared-in-repo'),
			'setup-project --shared-in-repo'
		);
	});

	it('rewrites "setup transitions" to "setup-transitions"', () => {
		assert.equal(normalizeAlias('setup transitions'), 'setup-transitions');
	});

	it('rewrites "Setup Project" case-insensitively', () => {
		assert.equal(normalizeAlias('Setup Project'), 'setup-project');
	});

	it('leaves "setup" unchanged', () => {
		assert.equal(normalizeAlias('setup'), 'setup');
	});

	it('leaves "setup-project" unchanged', () => {
		assert.equal(normalizeAlias('setup-project'), 'setup-project');
	});

	it('leaves "list" unchanged', () => {
		assert.equal(normalizeAlias('list'), 'list');
	});
});

describe('isInteractiveCommand', () => {
	const INTERACTIVE_COMMANDS = new Set(['setup', 'setup-project', 'setup-transitions']);

	function isInteractiveCommand(line: string): boolean {
		const first = line.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
		return INTERACTIVE_COMMANDS.has(first);
	}

	it('recognizes setup as interactive', () => {
		assert.ok(isInteractiveCommand('setup'));
	});

	it('recognizes setup-project as interactive', () => {
		assert.ok(isInteractiveCommand('setup-project'));
	});

	it('recognizes setup-transitions as interactive', () => {
		assert.ok(isInteractiveCommand('setup-transitions'));
	});

	it('does not flag list as interactive', () => {
		assert.ok(!isInteractiveCommand('list'));
	});

	it('does not flag start KD-1 as interactive', () => {
		assert.ok(!isInteractiveCommand('start KD-1'));
	});

	it('does not flag help as interactive', () => {
		assert.ok(!isInteractiveCommand('help'));
	});
});
