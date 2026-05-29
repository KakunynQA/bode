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

await runShell();
