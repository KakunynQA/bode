import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

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
