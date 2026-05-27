#!/usr/bin/env node
/**
 * Build single-executable applications (SEA) for bode using Node's built-in
 * SEA support (Node 20+). No third-party packager needed.
 *
 * Run from the repo root:
 *   node scripts/build-sea.mjs            # build for current platform
 *
 * Output: dist/bode-<platform>-<arch>(.exe)
 *
 * What it does:
 *   1. Runs `npm run build` to produce dist/index.js (the bundled CJS).
 *   2. Copies the local `node` binary as the SEA host.
 *   3. Generates a SEA blob from dist/index.js + a config.
 *   4. Injects the blob into the host using `postject` if available, or
 *      prints the manual injection command for the user.
 *
 * Notes:
 *   - The output is roughly 80-90MB (Node runtime + bundle). That's the
 *     trade-off for "no Node required on user's machine".
 *   - For cross-compilation, you need the target's `node` binary on hand.
 *     This script only builds for the host platform.
 *   - For the actual release pipeline that builds Linux/macOS/Windows
 *     binaries, see the CI workflow at `.github/workflows/release-sea.yml`.
 */

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function nodeMajor() {
	return parseInt(process.versions.node.split('.')[0] ?? '0', 10);
}

if (nodeMajor() < 20) {
	console.error(`SEA requires Node >=20 (got v${process.versions.node}).`);
	process.exit(1);
}

console.log('[1/4] Building bundle...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

const bundlePath = resolve(root, 'dist', 'index.js');
if (!existsSync(bundlePath)) {
	console.error(`Bundle not found at ${bundlePath}.`);
	process.exit(1);
}

const platform = process.platform;
const arch = process.arch;
const ext = platform === 'win32' ? '.exe' : '';
const outBase = resolve(root, 'dist', `bode-${platform}-${arch}${ext}`);

// 2. Write SEA config
const seaConfigPath = resolve(tmpdir(), 'bode-sea-config.json');
writeFileSync(
	seaConfigPath,
	JSON.stringify({
		main: bundlePath,
		output: resolve(tmpdir(), 'bode.blob'),
		disableExperimentalSEAWarning: true,
	}),
	'utf-8'
);

console.log('[2/4] Generating SEA blob...');
execSync(`node --experimental-sea-config "${seaConfigPath}"`, { stdio: 'inherit' });

// 3. Copy node binary as our host
const nodeExe = process.execPath;
console.log(`[3/4] Copying host binary from ${nodeExe} -> ${outBase}`);
mkdirSync(dirname(outBase), { recursive: true });
copyFileSync(nodeExe, outBase);

// 4. Inject the blob
const blobPath = resolve(tmpdir(), 'bode.blob');
const blobSize = statSync(blobPath).size;

console.log(`[4/4] Inject blob (${(blobSize / 1024).toFixed(1)} KB) into the host.`);
console.log('');
console.log('Run this command to inject (requires `postject`):');
const sentinel =
	platform === 'darwin' ? '--macho-segment-name NODE_SEA' : '';
console.log(
	`  npx postject "${outBase}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ${sentinel}`.trim()
);
console.log('');
console.log(`Output binary will be at: ${outBase}`);
console.log(`Approximate final size: ${((statSync(nodeExe).size + blobSize) / 1024 / 1024).toFixed(1)} MB`);

// Try injecting if postject is on PATH already.
try {
	execSync('npx --yes postject --version', { stdio: 'ignore' });
	console.log('');
	console.log('Found postject, injecting automatically...');
	const sentinelFuse =
		'--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
	const macFlag = platform === 'darwin' ? ' --macho-segment-name NODE_SEA' : '';
	execSync(`npx postject "${outBase}" NODE_SEA_BLOB "${blobPath}" ${sentinelFuse}${macFlag}`, {
		stdio: 'inherit',
	});
	console.log('');
	console.log(`✓ Done. Try it: ${outBase} --version`);
} catch {
	console.log('');
	console.log('postject not found; run the command above manually.');
}
