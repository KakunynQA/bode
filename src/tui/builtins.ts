import pc from 'picocolors';

export type CommandSummary = { name: string; usage: string; description: string };

export const COMMAND_HELP: { [category: string]: CommandSummary[] } = {
	Setup: [
		{
			name: 'setup',
			usage: 'setup',
			description: 'Configure tracker, AI CLIs per phase, VCS provider.',
		},
		{
			name: 'setup-project',
			usage: 'setup-project [--shared-in-repo] [--refresh-context]',
			description: 'Create or edit a project config.',
		},
		{
			name: 'setup-transitions',
			usage: 'setup-transitions [--project <name>]',
			description: 'Map bode phases to tracker workflow states.',
		},
		{
			name: 'init',
			usage: 'init [--overwrite] [--from <file>]',
			description: 'Scaffold AGENTS.md via the configured AI CLI.',
		},
		{
			name: 'learn',
			usage: 'learn [--refresh] [--detailed]',
			description: 'Generate <repo>/.bode/context.md for future phases.',
		},
	],
	Run: [
		{
			name: 'start',
			usage: 'start <KEY> [--auto|--strict|--dangerously-*]',
			description: 'Start a task. Creates branch, runs planning phase.',
		},
		{
			name: 'continue',
			usage: 'continue <KEY> [--dangerously-approve-all]',
			description: 'Advance to next phase.',
		},
		{ name: 'done', usage: 'done <KEY> [-y] [--auto-approve-pr-merge]', description: 'Mark done.' },
		{ name: 'abort', usage: 'abort <KEY> [-y]', description: 'Cancel execution, clean up branch.' },
		{
			name: 'new',
			usage: 'new <summary...>',
			description: 'Create local task without invoking AI.',
		},
		{ name: 'cancel', usage: 'cancel <KEY>', description: 'Remove scheduler entry.' },
	],
	Inspect: [
		{ name: 'status', usage: 'status <KEY>', description: 'Show phase, branch, PR, cost.' },
		{ name: 'show', usage: 'show <artifact> <KEY>', description: 'Print artifact to stdout.' },
		{ name: 'log', usage: 'log <KEY>', description: 'Show current/last phase log.' },
		{ name: 'list', usage: 'list [--watch]', description: 'List locally tracked tasks.' },
		{ name: 'skills', usage: 'skills [subcommand]', description: 'Show or install skills.' },
		{
			name: 'doctor',
			usage: 'doctor [--report]',
			description: 'Diagnose env, config, CLIs, VCS.',
		},
	],
	Manage: [
		{
			name: 'replay',
			usage: 'replay <KEY> [--phase|--with-cli|--export|--import]',
			description: 'Replay or bundle a run.',
		},
		{
			name: 'compare',
			usage: 'compare <KEY> --agents <list>',
			description: 'Run planning across agents.',
		},
		{
			name: 'feedback',
			usage: 'feedback [--title|--open]',
			description: 'Prefilled GitHub feedback URL.',
		},
		{
			name: 'telemetry',
			usage: 'telemetry [on|off|status|preview]',
			description: 'Opt-in telemetry control.',
		},
	],
	'Built-ins': [
		{ name: 'help', usage: 'help', description: 'Show this list.' },
		{ name: 'clear', usage: 'clear', description: 'Clear scrollback.' },
		{ name: 'exit', usage: 'exit', description: 'Exit the shell (also: quit, :q).' },
	],
};

export const KEY_REQUIRED_SUBCOMMANDS = new Set([
	'start',
	'continue',
	'status',
	'show',
	'replay',
	'log',
	'abort',
	'done',
	'cancel',
]);

export const ALL_SUBCOMMANDS = new Set([
	'setup',
	'setup-project',
	'setup-transitions',
	'init',
	'learn',
	'start',
	'continue',
	'done',
	'abort',
	'new',
	'cancel',
	'status',
	'show',
	'log',
	'list',
	'skills',
	'doctor',
	'replay',
	'compare',
	'feedback',
	'telemetry',
	'memory',
]);

export function renderHelp(): string {
	const lines: string[] = [];
	lines.push(pc.bold('Available commands:'));
	for (const [category, items] of Object.entries(COMMAND_HELP)) {
		lines.push('');
		lines.push(pc.cyan(category));
		for (const item of items) {
			lines.push(`  ${pc.bold(item.usage.padEnd(48))} ${pc.dim(item.description)}`);
		}
	}
	lines.push('');
	lines.push(pc.dim('Anything else is sent to the freeform fast path (creates a local task).'));
	return lines.join('\n');
}

export function clearScreen(): void {
	process.stdout.write('\x1B[2J\x1B[0;0H');
}
