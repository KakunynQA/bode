import pc from 'picocolors';
import { CancelledError } from '~/utils/prompt.ts';
import { ALL_SUBCOMMANDS, KEY_REQUIRED_SUBCOMMANDS, clearScreen, renderHelp } from './builtins.ts';

/**
 * Thrown by the monkey-patched `process.exit` during action execution so the
 * dispatcher can return the would-be exit code without actually killing the
 * shell. Lets us survive the 70+ `process.exit(1)` calls scattered across the
 * existing action files without touching them one by one.
 */
class InterceptedExitError extends Error {
	constructor(public code: number) {
		super(`process.exit(${code}) intercepted`);
		this.name = 'InterceptedExitError';
	}
}

async function runActionGuarded(invoke: () => Promise<number>): Promise<DispatchResult> {
	const originalExit = process.exit.bind(process);
	type ExitFn = typeof process.exit;
	process.exit = ((code?: number | string | null) => {
		const n = typeof code === 'number' ? code : code == null ? 0 : Number(code);
		throw new InterceptedExitError(Number.isFinite(n) ? n : 0);
	}) as ExitFn;
	try {
		const code = await invoke();
		return { kind: code === 0 ? 'ok' : 'error', exitCode: code };
	} catch (error) {
		if (error instanceof InterceptedExitError) {
			return { kind: error.code === 0 ? 'ok' : 'error', exitCode: error.code };
		}
		if (error instanceof CancelledError) return { kind: 'ok', exitCode: 0 };
		return { kind: 'error', exitCode: 1, error: error as Error };
	} finally {
		process.exit = originalExit;
	}
}

const TICKET_KEY_RE = /^[A-Z][A-Z0-9_]*-\d+$/;

export type DispatchKind = 'ok' | 'exit' | 'unknown' | 'noop' | 'error';

export type DispatchResult = {
	kind: DispatchKind;
	exitCode: number;
	error?: Error;
};

export type Parsed = {
	tokens: string[];
	options: Record<string, string | boolean>;
};

export type RouteDecision =
	| { kind: 'noop' }
	| { kind: 'exit' }
	| { kind: 'builtin'; name: 'help' | 'clear' }
	| { kind: 'subcommand'; name: string; parsed: Parsed }
	| { kind: 'fast'; line: string; options: Record<string, unknown> };

export function tokenize(line: string): string[] {
	const tokens: string[] = [];
	let i = 0;
	while (i < line.length) {
		const ch = line[i];
		if (ch === ' ' || ch === '\t') {
			i++;
			continue;
		}
		if (ch === '"') {
			i++;
			let buf = '';
			while (i < line.length && line[i] !== '"') {
				buf += line[i];
				i++;
			}
			if (i < line.length) i++; // skip closing quote
			tokens.push(buf);
			continue;
		}
		let buf = '';
		while (i < line.length && line[i] !== ' ' && line[i] !== '\t') {
			buf += line[i];
			i++;
		}
		tokens.push(buf);
	}
	return tokens;
}

// Flags that take a string value with the space-separated form (`--flag val`).
// Anything not in this set is treated as a boolean when written without `=`,
// so `start --auto KD-1` keeps `KD-1` as the positional ticket key instead of
// consuming it as the value of `--auto`. The `--flag=value` form always works
// regardless and is the right call for ambiguous flags like `--report path`.
export const KNOWN_STRING_FLAGS = new Set([
	'project',
	'from-branch',
	'with-cli',
	'with-model',
	'phase',
	'phases',
	'agents',
	'title',
	'diff',
	'pick',
	'from',
	'import',
]);

export function parseTokens(tokens: string[]): Parsed {
	const positionals: string[] = [];
	const options: Record<string, string | boolean> = {};
	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (!tok) continue;
		if (tok.startsWith('--')) {
			const eqIdx = tok.indexOf('=');
			if (eqIdx >= 0) {
				options[tok.slice(2, eqIdx)] = tok.slice(eqIdx + 1);
				continue;
			}
			const key = tok.slice(2);
			const next = tokens[i + 1];
			if (KNOWN_STRING_FLAGS.has(key) && next !== undefined && !next.startsWith('-')) {
				options[key] = next;
				i++;
			} else {
				options[key] = true;
			}
			continue;
		}
		if (tok.startsWith('-') && tok.length > 1) {
			const key = tok.slice(1);
			options[key] = true;
			continue;
		}
		positionals.push(tok);
	}
	return { tokens: positionals, options };
}

function camel(opt: string): string {
	return opt.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function camelizeOptions(options: Record<string, string | boolean>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(options)) {
		out[camel(k)] = v;
	}
	return out;
}

function looksLikeKey(value: string | undefined): boolean {
	if (value === undefined) return false;
	return TICKET_KEY_RE.test(value);
}

async function fallbackToFast(line: string, options: Record<string, unknown>): Promise<number> {
	const { fastAction } = await import('~/cli/actions/fast.ts');
	await fastAction(line, options as Parameters<typeof fastAction>[1]);
	return 0;
}

async function runRoute(name: string, parsed: Parsed): Promise<number> {
	const opts = camelizeOptions(parsed.options);
	const [first, second, ...rest] = parsed.tokens;
	void first; // command name already consumed before this call
	switch (name) {
		case 'setup': {
			const { setupAction } = await import('~/cli/actions/setup.ts');
			await setupAction();
			return 0;
		}
		case 'setup-project': {
			const { setupAction } = await import('~/cli/actions/setup.ts');
			await setupAction('project', opts);
			return 0;
		}
		case 'setup-transitions': {
			const { setupTransitionsAction } = await import('~/cli/actions/setup-transitions.ts');
			await setupTransitionsAction(opts);
			return 0;
		}
		case 'init': {
			const { initAction } = await import('~/cli/actions/init.ts');
			await initAction(opts);
			return 0;
		}
		case 'learn': {
			const { learnAction } = await import('~/cli/actions/learn.ts');
			await learnAction(opts);
			return 0;
		}
		case 'new': {
			if (parsed.tokens.length === 0) {
				console.error(pc.red('Usage: new <summary...>'));
				return 1;
			}
			const { newAction } = await import('~/cli/actions/new.ts');
			await newAction(parsed.tokens.join(' '), opts);
			return 0;
		}
		case 'start': {
			if (!second) {
				console.error(pc.red('Usage: start <KEY>'));
				return 1;
			}
			const { startAction } = await import('~/cli/actions/start.ts');
			await startAction(second, opts);
			return 0;
		}
		case 'continue': {
			if (!second) {
				console.error(pc.red('Usage: continue <KEY>'));
				return 1;
			}
			const { continueAction } = await import('~/cli/actions/continue.ts');
			await continueAction(second, opts);
			return 0;
		}
		case 'done': {
			if (!second) {
				console.error(pc.red('Usage: done <KEY>'));
				return 1;
			}
			const { doneAction } = await import('~/cli/actions/done.ts');
			await doneAction(second, opts);
			return 0;
		}
		case 'abort': {
			if (!second) {
				console.error(pc.red('Usage: abort <KEY>'));
				return 1;
			}
			const { abortAction } = await import('~/cli/actions/abort.ts');
			await abortAction(second, opts);
			return 0;
		}
		case 'cancel': {
			if (!second) {
				console.error(pc.red('Usage: cancel <KEY>'));
				return 1;
			}
			const { cancelAction } = await import('~/cli/actions/cancel.ts');
			await cancelAction(second);
			return 0;
		}
		case 'status': {
			if (!second) {
				console.error(pc.red('Usage: status <KEY>'));
				return 1;
			}
			const { statusAction } = await import('~/cli/actions/status.ts');
			await statusAction(second);
			return 0;
		}
		case 'show': {
			if (!second || rest.length === 0) {
				console.error(pc.red('Usage: show <artifact> <KEY>'));
				return 1;
			}
			const artifact = second;
			const key = rest[0];
			if (!key) {
				console.error(pc.red('Usage: show <artifact> <KEY>'));
				return 1;
			}
			const { showAction } = await import('~/cli/actions/show.ts');
			await showAction(artifact, key, opts);
			return 0;
		}
		case 'replay': {
			if (!second) {
				console.error(pc.red('Usage: replay <KEY>'));
				return 1;
			}
			const { replayAction } = await import('~/cli/actions/replay.ts');
			await replayAction(second, opts);
			return 0;
		}
		case 'log': {
			if (!second) {
				console.error(pc.red('Usage: log <KEY>'));
				return 1;
			}
			const { logAction } = await import('~/cli/actions/log.ts');
			await logAction(second);
			return 0;
		}
		case 'list': {
			const { listAction } = await import('~/cli/actions/list.ts');
			await listAction(opts);
			return 0;
		}
		case 'skills': {
			const { skillsAction } = await import('~/cli/actions/skills.ts');
			const subcommand = second;
			const args = rest;
			await skillsAction({
				...opts,
				...(subcommand ? { subcommand } : {}),
				args,
			} as Parameters<typeof skillsAction>[0]);
			return 0;
		}
		case 'doctor': {
			const { doctorAction } = await import('~/cli/actions/doctor.ts');
			await doctorAction(opts);
			return 0;
		}
		case 'feedback': {
			const { feedbackAction } = await import('~/cli/actions/feedback.ts');
			await feedbackAction(opts);
			return 0;
		}
		case 'telemetry': {
			const { telemetryAction } = await import('~/cli/actions/telemetry.ts');
			await telemetryAction(second);
			return 0;
		}
		case 'compare': {
			if (!second) {
				console.error(pc.red('Usage: compare <KEY> --agents <list>'));
				return 1;
			}
			const { compareAction } = await import('~/cli/actions/compare.ts');
			await compareAction(second, opts as Parameters<typeof compareAction>[1]);
			return 0;
		}
		case 'memory': {
			const { memoryAction } = await import('~/cli/actions/memory.ts');
			await memoryAction(second, rest);
			return 0;
		}
		default:
			console.error(pc.red(`Unknown command: ${name}. Type 'help' for the list.`));
			return 1;
	}
}

export function decideRoute(line: string): RouteDecision {
	const trimmed = line.trim();
	if (!trimmed) return { kind: 'noop' };
	const tokens = tokenize(trimmed);
	if (tokens.length === 0) return { kind: 'noop' };

	const lower = (tokens[0] ?? '').toLowerCase();
	if (lower === 'exit' || lower === 'quit' || lower === ':q') return { kind: 'exit' };
	if (lower === 'help' || lower === '?') return { kind: 'builtin', name: 'help' };
	if (lower === 'clear') return { kind: 'builtin', name: 'clear' };

	const first = tokens[0] ?? '';
	const parsed = parseTokens(tokens.slice(1));

	if (ALL_SUBCOMMANDS.has(first)) {
		// Disambiguation: bare prompts that start with a key-required subcommand
		// word (e.g. "start the project from scratch") fall through to fastAction.
		// Route to the subcommand only when the next positional looks like a key
		// (or there are zero positionals — likely a real usage error worth surfacing).
		if (KEY_REQUIRED_SUBCOMMANDS.has(first)) {
			const second = parsed.tokens[0];
			if (second !== undefined && !looksLikeKey(second)) {
				return { kind: 'fast', line: trimmed, options: camelizeOptions(parsed.options) };
			}
		}
		return { kind: 'subcommand', name: first, parsed };
	}

	return { kind: 'fast', line: trimmed, options: camelizeOptions(parsed.options) };
}

export async function dispatch(line: string): Promise<DispatchResult> {
	const decision = decideRoute(line);
	switch (decision.kind) {
		case 'noop':
			return { kind: 'noop', exitCode: 0 };
		case 'exit':
			return { kind: 'exit', exitCode: 0 };
		case 'builtin':
			if (decision.name === 'help') console.log(renderHelp());
			else clearScreen();
			return { kind: 'ok', exitCode: 0 };
		case 'subcommand':
			return runActionGuarded(() =>
				runRoute(decision.name, {
					tokens: [decision.name, ...decision.parsed.tokens],
					options: decision.parsed.options,
				})
			);
		case 'fast':
			return runActionGuarded(() => fallbackToFast(decision.line, decision.options));
	}
}
