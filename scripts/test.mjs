#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const files = walk('tests/unit').sort();
if (files.length === 0) {
  console.error('No test files found under tests/unit/');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', ...files],
  { stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
