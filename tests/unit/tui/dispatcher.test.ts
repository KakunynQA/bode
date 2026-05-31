import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideRoute, parseTokens, tokenize, __testing } from '~/tui/dispatcher.ts';
import { CancelledError, TerminateShellError } from '~/utils/prompt.ts';

const { runActionGuarded } = __testing;

describe('tokenize', () => {
	it('splits bare words on whitespace', () => {
		assert.deepEqual(tokenize('start KD-1 --auto'), ['start', 'KD-1', '--auto']);
	});

	it('preserves double-quoted groups', () => {
		assert.deepEqual(tokenize('new "fix the bug"'), ['new', 'fix the bug']);
	});

	it('returns an empty array for blank input', () => {
		assert.deepEqual(tokenize(''), []);
		assert.deepEqual(tokenize('   '), []);
	});
});

describe('parseTokens', () => {
	it('separates positionals from --flag forms', () => {
		const parsed = parseTokens(['KD-1', '--auto']);
		assert.deepEqual(parsed.tokens, ['KD-1']);
		assert.deepEqual(parsed.options, { auto: true });
	});

	it('handles --key=value', () => {
		const parsed = parseTokens(['KD-1', '--project=grid']);
		assert.deepEqual(parsed.options, { project: 'grid' });
	});

	it('handles --key value (space form)', () => {
		const parsed = parseTokens(['KD-1', '--project', 'grid']);
		assert.deepEqual(parsed.options, { project: 'grid' });
	});

	it('handles short -y as boolean', () => {
		const parsed = parseTokens(['KD-1', '-y']);
		assert.deepEqual(parsed.options, { y: true });
	});

	it('keeps positionals after a boolean flag (no operand consumption)', () => {
		// `start --auto KD-1` — without the known-string-flag list, the parser
		// previously ate KD-1 as the value of --auto. KD-1 must stay positional.
		const parsed = parseTokens(['--auto', 'KD-1']);
		assert.deepEqual(parsed.tokens, ['KD-1']);
		assert.deepEqual(parsed.options, { auto: true });
	});

	it('still consumes the space-separated value for a known string flag', () => {
		const parsed = parseTokens(['--project', 'grid', 'KD-1']);
		assert.deepEqual(parsed.tokens, ['KD-1']);
		assert.deepEqual(parsed.options, { project: 'grid' });
	});
});

describe('decideRoute', () => {
	it('routes setup to subcommand with no positionals', () => {
		const d = decideRoute('setup');
		assert.equal(d.kind, 'subcommand');
		if (d.kind === 'subcommand') assert.equal(d.name, 'setup');
	});

	it('routes "start KD-1" to subcommand', () => {
		const d = decideRoute('start KD-1');
		assert.equal(d.kind, 'subcommand');
		if (d.kind === 'subcommand') {
			assert.equal(d.name, 'start');
			assert.deepEqual(d.parsed.tokens, ['KD-1']);
		}
	});

	it('routes "start KD-1 --auto" to subcommand with flag', () => {
		const d = decideRoute('start KD-1 --auto');
		assert.equal(d.kind, 'subcommand');
		if (d.kind === 'subcommand') {
			assert.equal(d.name, 'start');
			assert.deepEqual(d.parsed.options, { auto: true });
		}
	});

	it('routes "done KD-1 --yes" with the yes flag', () => {
		const d = decideRoute('done KD-1 --yes');
		assert.equal(d.kind, 'subcommand');
		if (d.kind === 'subcommand') {
			assert.deepEqual(d.parsed.options, { yes: true });
		}
	});

	it('routes a quoted freeform prompt to fast', () => {
		const d = decideRoute('"fix the bug"');
		assert.equal(d.kind, 'fast');
		if (d.kind === 'fast') assert.equal(d.line, '"fix the bug"');
	});

	it('routes an unquoted freeform prompt to fast', () => {
		const d = decideRoute('fix the bug');
		assert.equal(d.kind, 'fast');
	});

	it('disambiguates "start the project from scratch" to fast', () => {
		const d = decideRoute('start the project from scratch');
		assert.equal(d.kind, 'fast');
	});

	it('still routes "start KD-1 --project=grid" to subcommand', () => {
		const d = decideRoute('start KD-1 --project=grid');
		assert.equal(d.kind, 'subcommand');
		if (d.kind === 'subcommand') assert.equal(d.parsed.options.project, 'grid');
	});

	it('routes "start --auto KD-1" with the flag before the key', () => {
		const d = decideRoute('start --auto KD-1');
		assert.equal(d.kind, 'subcommand');
		if (d.kind === 'subcommand') {
			assert.deepEqual(d.parsed.tokens, ['KD-1']);
			assert.equal(d.parsed.options.auto, true);
		}
	});

	it('routes "show --html plan KD-1" with the boolean flag before positionals', () => {
		const d = decideRoute('show --html plan KD-1');
		assert.equal(d.kind, 'subcommand');
		if (d.kind === 'subcommand') {
			assert.equal(d.name, 'show');
			assert.deepEqual(d.parsed.tokens, ['plan', 'KD-1']);
			assert.equal(d.parsed.options.html, true);
		}
	});

	it('recognises help, ?, clear, exit, quit, :q', () => {
		assert.equal(decideRoute('help').kind, 'builtin');
		assert.equal(decideRoute('?').kind, 'builtin');
		assert.equal(decideRoute('clear').kind, 'builtin');
		assert.equal(decideRoute('exit').kind, 'exit');
		assert.equal(decideRoute('quit').kind, 'exit');
		assert.equal(decideRoute(':q').kind, 'exit');
	});

	it('returns noop for blank input', () => {
		assert.equal(decideRoute('').kind, 'noop');
		assert.equal(decideRoute('   ').kind, 'noop');
	});

	it('routes an unknown first token to fast', () => {
		const d = decideRoute('bogus-subcommand whatever');
		assert.equal(d.kind, 'fast');
	});
});

describe('runActionGuarded — Ctrl+C / cancel semantics (v2.1 contract)', () => {
	it('re-throws TerminateShellError so the shell loop can exit', async () => {
		await assert.rejects(
			runActionGuarded(async () => {
				throw new TerminateShellError();
			}),
			(err: unknown) => err instanceof TerminateShellError
		);
	});

	it('returns kind=ok on CancelledError (per-action cancel)', async () => {
		const result = await runActionGuarded(async () => {
			throw new CancelledError();
		});
		assert.equal(result.kind, 'ok');
		assert.equal(result.exitCode, 0);
	});

	it('translates process.exit(0) into kind=ok', async () => {
		const result = await runActionGuarded(async () => {
			process.exit(0);
		});
		assert.equal(result.kind, 'ok');
		assert.equal(result.exitCode, 0);
	});

	it('translates process.exit(1) into kind=error with exitCode=1', async () => {
		const result = await runActionGuarded(async () => {
			process.exit(1);
		});
		assert.equal(result.kind, 'error');
		assert.equal(result.exitCode, 1);
	});

	it('returns kind=ok and exitCode=0 for a clean async return of 0', async () => {
		const result = await runActionGuarded(async () => 0);
		assert.equal(result.kind, 'ok');
		assert.equal(result.exitCode, 0);
	});

	it('returns kind=error with the original error for unexpected throws', async () => {
		const result = await runActionGuarded(async () => {
			throw new Error('boom');
		});
		assert.equal(result.kind, 'error');
		assert.equal(result.exitCode, 1);
		assert.equal(result.error?.message, 'boom');
	});
});
