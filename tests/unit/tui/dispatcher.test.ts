import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideRoute, parseTokens, tokenize } from '~/tui/dispatcher.ts';

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
