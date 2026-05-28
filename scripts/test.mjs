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

const all = process.argv.includes('--all');
const dirs = ['tests/unit'];
if (all) {
  try { readdirSync('tests/integration'); dirs.push('tests/integration'); } catch {}
  try { readdirSync('tests/smoke'); dirs.push('tests/smoke'); } catch {}
}
const files = dirs.flatMap(d => walk(d)).sort();
if (files.length === 0) {
  console.error(`No test files found under ${dirs.join(', ')}`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', ...files],
  { stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
