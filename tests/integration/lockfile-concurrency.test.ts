import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm, writeFile, mkdir, readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { acquireLock, inspectLock } from '~/storage/lockfile.ts';
import { getRunDir } from '~/config/defaults.ts';

const keys: string[] = [];

function makeKey(label: string): string {
	const k = `TEST-INT-${label}-${process.pid}-${Date.now()}`;
	keys.push(k);
	return k;
}

function runChild(
	script: string
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, ['--import', 'tsx', '-e', script], {
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (d: Buffer) => {
			stdout += d.toString();
		});
		child.stderr.on('data', (d: Buffer) => {
			stderr += d.toString();
		});
		child.on('exit', (code) => {
			resolve({ stdout, stderr, code });
		});
	});
}

describe('lockfile concurrency integration', () => {
	after(async () => {
		await Promise.all(keys.map((k) => rm(getRunDir(k), { recursive: true, force: true })));
	});

	describe('single-process acquire and release', () => {
		it('acquireLock succeeds for a new task key', async () => {
			const key = makeKey('new');
			const lock = await acquireLock(key, 'test-new');
			assert.ok(lock.ok);

			const info = await inspectLock(key);
			assert.ok(info);
			assert.equal(info!.pid, process.pid);
			assert.equal(info!.host, hostname());
			assert.equal(info!.command, 'test-new');
			assert.ok(typeof info!.startedAt === 'number');

			await lock.value.release();
		});

		it('release removes the lock file', async () => {
			const key = makeKey('release');
			const lock = await acquireLock(key, 'test-release');
			assert.ok(lock.ok);
			await lock.value.release();

			const info = await inspectLock(key);
			assert.equal(info, null);
		});

		it('release is idempotent', async () => {
			const key = makeKey('idempotent');
			const lock = await acquireLock(key, 'test-idempotent');
			assert.ok(lock.ok);
			await lock.value.release();
			await lock.value.release();

			const info = await inspectLock(key);
			assert.equal(info, null);
		});

		it('inspectLock returns null when no lock exists', async () => {
			const key = makeKey('no-lock');
			const info = await inspectLock(key);
			assert.equal(info, null);
		});

		it('inspectLock returns lock info when present', async () => {
			const key = makeKey('inspect');
			const lock = await acquireLock(key, 'test-inspect');
			assert.ok(lock.ok);

			const info = await inspectLock(key);
			assert.ok(info);
			assert.equal(info!.pid, process.pid);
			assert.equal(info!.host, hostname());
			assert.equal(info!.command, 'test-inspect');

			await lock.value.release();
		});
	});

	describe('stale lock recovery', () => {
		it('recovers a stale lock with a dead pid', async () => {
			const key = makeKey('stale-dead');
			await mkdir(getRunDir(key), { recursive: true });
			const fake = {
				pid: 999999999,
				host: hostname(),
				startedAt: Date.now(),
				command: 'dead-process',
			};
			await writeFile(join(getRunDir(key), '.lock'), JSON.stringify(fake));

			const lock = await acquireLock(key, 'test-stale-dead');
			assert.ok(lock.ok);

			const info = await inspectLock(key);
			assert.ok(info);
			assert.equal(info!.pid, process.pid);

			await lock.value.release();
		});

		it('recovers a stale lock from a different host', async () => {
			const key = makeKey('stale-host');
			await mkdir(getRunDir(key), { recursive: true });
			const fake = {
				pid: process.pid,
				host: 'not-this-host-at-all',
				startedAt: Date.now(),
				command: 'remote-process',
			};
			await writeFile(join(getRunDir(key), '.lock'), JSON.stringify(fake));

			const lock = await acquireLock(key, 'test-stale-host');
			assert.ok(lock.ok);

			const info = await inspectLock(key);
			assert.ok(info);
			assert.equal(info!.host, hostname());

			await lock.value.release();
		});

		it('recovers a corrupt lock file', async () => {
			const key = makeKey('stale-corrupt');
			await mkdir(getRunDir(key), { recursive: true });
			await writeFile(join(getRunDir(key), '.lock'), 'not valid json {{{');

			const lock = await acquireLock(key, 'test-stale-corrupt');
			assert.ok(lock.ok);

			const info = await inspectLock(key);
			assert.ok(info);
			assert.equal(info!.pid, process.pid);

			await lock.value.release();
		});
	});

	describe('lock held by live process', () => {
		it('refuses when lock is held by a live child process', async () => {
			const key = makeKey('held-live');

			const childScript = `
				import { acquireLock } from '~/storage/lockfile.ts';
				const result = await acquireLock('${key}', 'child-holds');
				process.stdout.write(JSON.stringify({ ok: result.ok, pid: process.pid }));
				if (result.ok) {
					await new Promise((r) => setTimeout(r, 3000));
					await result.value.release();
				}
			`;

			const childPromise = runChild(childScript);

			await new Promise((r) => setTimeout(r, 500));

			const result = await acquireLock(key, 'parent-attempts');
			assert.ok(!result.ok, 'parent should fail while child holds lock');
			assert.ok(result.error instanceof Error);
			assert.match(result.error.message, /locked by another bode process/);

			const { stdout, code } = await childPromise;
			assert.equal(code, 0);
			const childParsed = JSON.parse(stdout.trim());
			assert.ok(childParsed.ok, 'child should have acquired the lock');
		});
	});

	describe('concurrent child-process acquisition', () => {
		it('child fails to acquire lock held by parent', async () => {
			const key = makeKey('fork-blocked');

			const parentLock = await acquireLock(key, 'parent');
			assert.ok(parentLock.ok);

			const childScript = `
				import { acquireLock } from '~/storage/lockfile.ts';
				const result = await acquireLock('${key}', 'child');
				process.stdout.write(JSON.stringify({ ok: result.ok }));
				process.exit(0);
			`;

			const { stdout, code } = await runChild(childScript);

			assert.equal(code, 0);
			const parsed = JSON.parse(stdout.trim());
			assert.ok(!parsed.ok, 'child should fail to acquire lock held by parent');

			await parentLock.value.release();
		});

		it('child succeeds after parent releases lock', async () => {
			const key = makeKey('fork-after-release');

			const parentLock = await acquireLock(key, 'parent');
			assert.ok(parentLock.ok);
			await parentLock.value.release();

			const childScript = `
				import { acquireLock } from '~/storage/lockfile.ts';
				const result = await acquireLock('${key}', 'child');
				if (result.ok) {
					await result.value.release();
				}
				process.stdout.write(JSON.stringify({ ok: result.ok }));
				process.exit(0);
			`;

			const { stdout, code } = await runChild(childScript);

			assert.equal(code, 0);
			const parsed = JSON.parse(stdout.trim());
			assert.ok(parsed.ok, 'child should acquire lock after parent releases');
		});

		it('sequential children: second fails while first holds lock', async () => {
			const key = makeKey('seq-lock');
			const tmpDir = await mkdtemp(join(tmpdir(), 'bode-locktest-'));

			const childScriptPath = join(tmpDir, 'holder.ts');
			const childCode = `
				import { acquireLock } from '~/storage/lockfile.ts';
				(async () => {
					const result = await acquireLock('${key}', 'holder');
					const ok = result.ok;
					if (ok) {
						await new Promise((r) => setTimeout(r, 2000));
						await result.value.release();
					}
					process.stdout.write(ok ? '1' : '0');
				})();
			`;
			await writeFile(childScriptPath, childCode);

			const holder = spawn(process.execPath, ['--import', 'tsx', childScriptPath], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			await new Promise((r) => setTimeout(r, 300));

			const secondResult = await acquireLock(key, 'second');
			assert.equal(secondResult.ok, false, 'second acquire should fail while first holds lock');

			holder.kill();
			await new Promise<void>((resolve) => holder.on('exit', () => resolve()));

			await rm(tmpDir, { recursive: true, force: true });
		});
	});

	describe('lock file structure', () => {
		it('writes valid JSON with all required fields', async () => {
			const key = makeKey('structure');
			const lock = await acquireLock(key, 'test-structure');
			assert.ok(lock.ok);

			const lockPath = join(getRunDir(key), '.lock');
			assert.ok(existsSync(lockPath));

			const raw = await readFile(lockPath, 'utf-8');
			const parsed = JSON.parse(raw);

			assert.ok(typeof parsed.pid === 'number');
			assert.ok(typeof parsed.host === 'string');
			assert.ok(typeof parsed.startedAt === 'number');
			assert.ok(typeof parsed.command === 'string');
			assert.equal(parsed.pid, process.pid);
			assert.equal(parsed.host, hostname());
			assert.equal(parsed.command, 'test-structure');

			await lock.value.release();
		});
	});

	describe('multiple distinct task keys', () => {
		it('can hold locks on different task keys simultaneously', async () => {
			const keyA = makeKey('multi-a');
			const keyB = makeKey('multi-b');
			const keyC = makeKey('multi-c');

			const lockA = await acquireLock(keyA, 'multi-a');
			const lockB = await acquireLock(keyB, 'multi-b');
			const lockC = await acquireLock(keyC, 'multi-c');

			assert.ok(lockA.ok);
			assert.ok(lockB.ok);
			assert.ok(lockC.ok);

			const infoA = await inspectLock(keyA);
			const infoB = await inspectLock(keyB);
			const infoC = await inspectLock(keyC);

			assert.ok(infoA);
			assert.ok(infoB);
			assert.ok(infoC);
			assert.equal(infoA!.command, 'multi-a');
			assert.equal(infoB!.command, 'multi-b');
			assert.equal(infoC!.command, 'multi-c');

			await lockA.value.release();
			await lockB.value.release();
			await lockC.value.release();

			assert.equal(await inspectLock(keyA), null);
			assert.equal(await inspectLock(keyB), null);
			assert.equal(await inspectLock(keyC), null);
		});
	});
});
