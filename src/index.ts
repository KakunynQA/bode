import pc from 'picocolors';
import { getVersion } from './utils/version.ts';
import { renderHelp } from './tui/builtins.ts';
import { runShell } from './tui/shell.ts';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-V')) {
	console.log(getVersion());
	process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
	console.log(pc.bold('bode') + pc.dim(` v${getVersion()}`));
	console.log('Orchestrate AI coding work through configurable phases.');
	console.log('');
	console.log(pc.dim('Run `bode` to launch the interactive shell.'));
	console.log(pc.dim('Inside the shell, type any command below without the `bode ` prefix.'));
	console.log('');
	console.log(renderHelp());
	process.exit(0);
}

if (!process.stdin.isTTY) {
	console.error(pc.red('bode requires an interactive terminal (TTY).'));
	console.error(
		pc.dim('Headless invocation was removed in v2.0.0. Use --version or --help for headless info.')
	);
	process.exit(2);
}

// Wrapped in a self-executing async function to dodge Node 22+'s spurious
// "unsettled top-level await" diagnostic, which can fire mid-prompt when
// the shell hands stdin to inquirer (the original top-level await stays
// pending for the whole session, which Node's heuristic flags as a leak).
void (async () => {
	try {
		await runShell();
	} catch (error) {
		console.error(pc.red((error as Error).message ?? String(error)));
		process.exit(1);
	}
})();
