import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artPath = resolve(root, 'src', 'assets', 'bode.art');
const goatArt = readFileSync(artPath, 'utf-8');

const skillPlanning = readFileSync(resolve(root, 'src/skills/defaults/planning.md'), 'utf-8');
const skillPlanReview = readFileSync(resolve(root, 'src/skills/defaults/plan-review.md'), 'utf-8');
const skillImplementation = readFileSync(
	resolve(root, 'src/skills/defaults/implementation.md'),
	'utf-8'
);
const skillReview = readFileSync(resolve(root, 'src/skills/defaults/review.md'), 'utf-8');
const skillLearn = readFileSync(resolve(root, 'src/skills/defaults/learn.md'), 'utf-8');
const skillInitAgents = readFileSync(
	resolve(root, 'src/skills/defaults/init-agents.md'),
	'utf-8'
);

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));

await build({
	entryPoints: ['src/index.ts'],
	bundle: true,
	platform: 'node',
	target: 'node20',
	format: 'esm',
	outdir: 'dist',
	banner: {
		js: [
			'#!/usr/bin/env node',
			"import { createRequire as __bode_createRequire } from 'node:module';",
			'const require = __bode_createRequire(import.meta.url);',
		].join('\n'),
	},
	define: {
		__GOAT_ART__: JSON.stringify(goatArt),
		__VERSION__: JSON.stringify(pkg.version),
		__SKILL_PLANNING__: JSON.stringify(skillPlanning),
		__SKILL_PLAN_REVIEW__: JSON.stringify(skillPlanReview),
		__SKILL_IMPLEMENTATION__: JSON.stringify(skillImplementation),
		__SKILL_REVIEW__: JSON.stringify(skillReview),
		__SKILL_LEARN__: JSON.stringify(skillLearn),
		__SKILL_INIT_AGENTS__: JSON.stringify(skillInitAgents),
	},
	external: ['react-devtools-core'],
	minify: false,
	sourcemap: false,
	packages: 'bundle',
	alias: {
		'~': './src',
	},
	logLevel: 'info',
});

console.log(`Build complete: dist/index.js (v${pkg.version})`);
