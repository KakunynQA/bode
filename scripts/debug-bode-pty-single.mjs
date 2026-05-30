// Minimum harness: types "setup", sends \r, waits 6s.
// If the bug is present: child exits (alive=false).
// If the bug is fixed: child stays alive after rendering Q1 (alive=true).
import { spawn as ptySpawn } from 'node-pty';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const bodeDist =
	process.argv[2] === '--global'
		? 'C:\\Users\\eucom\\AppData\\Roaming\\npm\\node_modules\\bode\\dist\\index.js'
		: resolve('dist/index.js');
const logPath = join(homedir(), 'bode-cancel.log');
if (existsSync(logPath)) {
	const { unlinkSync } = await import('node:fs');
	unlinkSync(logPath);
}

const child = ptySpawn(process.execPath, [bodeDist], {
	name: 'xterm-256color',
	cols: 120,
	rows: 30,
	cwd: process.cwd(),
	env: { ...process.env, BODE_DEBUG_CANCEL: '1' },
});

let transcript = '';
child.onData((d) => {
	transcript += d;
	process.stdout.write(d);
});
let exitCode = null;
child.onExit(({ exitCode: c }) => {
	exitCode = c;
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await sleep(2500);
console.log('\n[harness] writing "setup"');
child.write('setup');
await sleep(400);
console.log('[harness] writing "\\r"');
child.write('\r');
await sleep(6000);
const alive = exitCode === null;
console.log(`\n[harness] after 6s wait — alive? ${alive} exitCode=${exitCode}`);
const hasJiraPrompt = transcript.includes('Jira site');
console.log(`[harness] Q1 rendered? ${hasJiraPrompt}`);
if (alive) child.kill();
writeFileSync(resolve('.local/debug/last-transcript.txt'), transcript);
console.log(`[harness] PASS: bug FIXED (Q1 rendered AND process alive)? ${hasJiraPrompt && alive}`);
