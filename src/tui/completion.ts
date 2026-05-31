import { ALL_SUBCOMMANDS } from './builtins.ts';

/**
 * Per-subcommand flag set. Sourced from the COMMAND_HELP usage strings and
 * the dispatcher's KNOWN_STRING_FLAGS — kept as a flat list here so Tab
 * completion is a constant-time lookup with no parsing.
 *
 * Edits to this table should match the usage strings in `builtins.ts`. The
 * `none` entry exists so completion for a subcommand without flags returns
 * an empty list cleanly.
 */
export const COMMAND_FLAGS: Record<string, string[]> = {
	setup: [],
	'setup-project': ['--shared-in-repo', '--refresh-context'],
	'setup-transitions': ['--project'],
	init: ['--overwrite', '--from'],
	learn: ['--refresh', '--detailed'],
	start: [
		'--auto',
		'--strict',
		'--dangerously-approve-all',
		'--project',
		'--with-cli',
		'--with-model',
		'--from-branch',
	],
	continue: ['--dangerously-approve-all', '--phase'],
	done: ['--auto-approve-pr-merge', '-y'],
	abort: ['-y'],
	new: ['--title'],
	cancel: [],
	status: [],
	show: ['--diff', '--html'],
	log: [],
	list: ['--watch'],
	skills: [],
	doctor: ['--report'],
	replay: ['--phase', '--with-cli', '--with-model', '--export', '--import', '--from', '--pick'],
	compare: ['--agents'],
	feedback: ['--title', '--open'],
	telemetry: [],
	memory: [],
};

/**
 * Builtin tokens that the dispatcher resolves before any subcommand lookup.
 * Included in first-token completion so `h<Tab>` → `help`.
 */
const BUILTIN_TOKENS = ['help', '?', 'clear', 'exit', 'quit', ':q'];

export type CompletionResult =
	| { kind: 'noop' }
	| { kind: 'insert'; buffer: string; cursor: number }
	| { kind: 'candidates'; candidates: string[] };

/**
 * Tab-completion for the TUI prompt buffer.
 *
 * - Empty buffer ⇒ noop.
 * - First-token completion: candidates = ALL_SUBCOMMANDS ∪ BUILTIN_TOKENS.
 * - Subsequent flag-shaped token (starts with `-`): candidates =
 *   COMMAND_FLAGS[firstToken] (or [] if the first token is unknown).
 * - Non-flag positionals are not completed (ticket keys, etc.).
 *
 * On a single match: returns `{ kind: 'insert', buffer, cursor }` — buffer
 * with the candidate substituted in place of the in-progress token,
 * cursor at the end of the inserted text.
 *
 * On multiple matches: returns `{ kind: 'candidates', candidates }`. The
 * caller is responsible for displaying them.
 */
export function completeBuffer(buffer: string, cursor: number): CompletionResult {
	if (buffer.length === 0) return { kind: 'noop' };

	// Locate the token under the cursor. Tokens split on single spaces.
	// We accept a trailing space (cursor sits at len) and treat it as
	// "start a new empty token".
	const upToCursor = buffer.slice(0, cursor);
	const lastSpace = upToCursor.lastIndexOf(' ');
	const tokenStart = lastSpace + 1;
	const tokenEnd = cursor;
	const partial = buffer.slice(tokenStart, tokenEnd);

	// Determine if this is the first token of the line.
	const beforeToken = buffer.slice(0, tokenStart);
	const isFirstToken = beforeToken.trim() === '';

	let pool: string[];
	if (isFirstToken) {
		pool = [...Array.from(ALL_SUBCOMMANDS), ...BUILTIN_TOKENS];
	} else if (partial.startsWith('-')) {
		// Flag completion. Find the first non-whitespace token.
		const firstToken = (buffer.match(/^\s*(\S+)/)?.[1] ?? '').toLowerCase();
		pool = COMMAND_FLAGS[firstToken] ?? [];
	} else {
		// Positional — no completion source.
		return { kind: 'noop' };
	}

	const matches = pool.filter((c) => c.startsWith(partial));
	if (matches.length === 0) return { kind: 'noop' };
	if (matches.length === 1) {
		const completed = matches[0]!;
		const newBuffer = buffer.slice(0, tokenStart) + completed + buffer.slice(tokenEnd);
		return { kind: 'insert', buffer: newBuffer, cursor: tokenStart + completed.length };
	}
	// Multiple matches — common prefix expansion is a nice touch but the
	// plan explicitly asks for "list the candidates" on multi-match. Stay
	// in spec.
	return { kind: 'candidates', candidates: matches.sort() };
}
