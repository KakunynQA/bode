import { Command } from 'commander';
import { createCommands } from './commands.ts';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('bode')
    .description('Orchestrate AI coding work through configurable phases')
    .version('0.3.0');

  createCommands(program);

  return program;
}
