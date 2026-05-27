import { Command } from 'commander';
import { createCommands } from './commands.ts';
import { getVersion } from '~/utils/version.ts';

export function createProgram(): Command {
	const program = new Command();

	program
		.name('bode')
		.description('Orchestrate AI coding work through configurable phases')
		.version(getVersion());

	createCommands(program);

	return program;
}
