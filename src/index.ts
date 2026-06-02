import pc from 'picocolors';
import { getVersion } from './utils/version.ts';
import { renderHelp } from './tui/builtins.ts';
import { runShell } from './tui/shell.ts';
import { dispatch } from './tui/dispatcher.ts';

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
	console.log(pc.dim('You can also run commands directly: `bode setup`, `bode start KD-1`, etc.'));
	console.log('');
	console.log(renderHelp());
	process.exit(0);
}

const isExplicitCommand = args.length > 0 && !args[0]!.startsWith('-');

if (isExplicitCommand) {
	const line = args.join(' ');
	void (async () => {
		try {
			const result = await dispatch(line);
			if (result.kind === 'error' && result.error) {
				console.error(pc.red(`error: ${result.error.message}`));
			}
			process.exit(result.exitCode);
		} catch (error) {
			console.error(pc.red((error as Error).message ?? String(error)));
			process.exit(1);
		}
	})().catch((err) => {
		console.error(pc.red(String(err)));
		process.exit(1);
	});
} else if (!process.stdin.isTTY) {
	console.error(pc.red('bode requires an interactive terminal (TTY).'));
	console.error(pc.dim('Use --version or --help for headless info.'));
	console.error(pc.dim('Explicit commands like `bode setup` also work without a TTY.'));
	process.exit(2);
} else {
	void (async () => {
		try {
			await runShell();
		} catch (error) {
			console.error(pc.red((error as Error).message ?? String(error)));
			process.exit(1);
		}
	})().catch((err) => {
		console.error(pc.red(String(err)));
		process.exit(1);
	});
}
