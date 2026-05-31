import { ALL_SUBCOMMANDS } from './builtins.ts';

/**
 * Per-subcommand flag set. Sourced from the COMMAND_HELP usage strings and
 * the dispatcher's KNOWN_STRING_FLAGS — kept as a flat list so completion
 * is a constant-time lookup with no parsing.
 *
 * Order matters: the first entry that extends the user's partial wins the
 * ghost-completion slot.
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
 * Included in first-token completion so `h` shows ghost `elp`.
 */
const BUILTIN_TOKENS = ['help', 'clear', 'exit', 'quit', '?', ':q'];

/**
 * Returns the suffix to render as dim ghost text after the user's buffer.
 * Empty string means "no completion available right now". Tab accepts the
 * ghost — the caller just concatenates `buffer + ghost`.
 *
 * Rules:
 * - Buffer empty ⇒ no ghost.
 * - Cursor not at the end of the buffer ⇒ no ghost (the user is editing
 *   mid-text; offering a suffix would be confusing).
 * - The token at the cursor is the partial we try to complete.
 *   - First token ⇒ pool is ALL_SUBCOMMANDS ∪ BUILTIN_TOKENS.
 *   - Token starts with `-` ⇒ pool is COMMAND_FLAGS[first-token].
 *   - Otherwise (positional like a ticket key) ⇒ no ghost.
 * - We pick the **first** pool entry that strictly extends the partial
 *   (starts with it AND is longer). When the partial is already an exact
 *   match for one entry, we keep scanning for a longer one — that way
 *   `setup` (exact) still surfaces `-project` as the next ghost.
 */
export function ghostCompletion(buffer: string, cursor: number): string {
	if (buffer.length === 0) return '';
	if (cursor !== buffer.length) return '';

	const upToCursor = buffer.slice(0, cursor);
	const lastSpace = upToCursor.lastIndexOf(' ');
	const tokenStart = lastSpace + 1;
	const partial = buffer.slice(tokenStart);
	if (partial.length === 0) return '';

	const beforeToken = buffer.slice(0, tokenStart);
	const isFirstToken = beforeToken.trim() === '';

	let pool: string[];
	if (isFirstToken) {
		pool = [...Array.from(ALL_SUBCOMMANDS), ...BUILTIN_TOKENS];
	} else if (partial.startsWith('-')) {
		const firstToken = (buffer.match(/^\s*(\S+)/)?.[1] ?? '').toLowerCase();
		pool = COMMAND_FLAGS[firstToken] ?? [];
	} else {
		return '';
	}

	const match = pool.find((c) => c.startsWith(partial) && c.length > partial.length);
	if (!match) return '';
	return match.slice(partial.length);
}
