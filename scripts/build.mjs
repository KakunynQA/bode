import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const artPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'bode.art');
const goatArt = readFileSync(artPath, 'utf-8');

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outdir: 'dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    '__GOAT_ART__': JSON.stringify(goatArt),
  },
  external: [],
  minify: false,
  sourcemap: false,
  packages: 'bundle',
  alias: {
    '~': './src',
  },
  logLevel: 'info',
});

console.log('Build complete: dist/index.js');
