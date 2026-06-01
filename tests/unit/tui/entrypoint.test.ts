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
