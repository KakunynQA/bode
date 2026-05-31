import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadHistory, appendHistory, HISTORY_MAX } from '~/tui/history.ts';

const BASE = join(tmpdir(), 'bode-test-history-' + process.pid);
const HISTORY_PATH = join(BASE, 'history');

describe('loadHistory', () => {
	before(async () => {
		await mkdir(BASE, { recursive: true });
	});

	after(async () => {
		await rm(BASE, { recursive: true, force: true });
	});

	it('returns empty when the file does not exist', async () => {
		const lines = await loadHistory(join(BASE, 'never-existed'));
		assert.deepEqual(lines, []);
	});

	it('reads commands chronologically (oldest first)', async () => {
		await writeFile(HISTORY_PATH, 'start KD-1\nsetup\nlist\n', 'utf8');
		const lines = await loadHistory(HISTORY_PATH);
		assert.deepEqual(lines, ['start KD-1', 'setup', 'list']);
	});

	it('drops blank lines and whitespace-only lines', async () => {
		await writeFile(HISTORY_PATH, '\nfoo\n   \nbar\n\n', 'utf8');
		const lines = await loadHistory(HISTORY_PATH);
		assert.deepEqual(lines, ['foo', 'bar']);
	});

	it('trims surrounding whitespace per entry', async () => {
		await writeFile(HISTORY_PATH, '  spaced  \n\tquoted\t\n', 'utf8');
		const lines = await loadHistory(HISTORY_PATH);
		assert.deepEqual(lines, ['spaced', 'quoted']);
	});
});

describe('appendHistory', () => {
	const APPEND_PATH = join(BASE, 'append-history');

	before(async () => {
		await mkdir(BASE, { recursive: true });
	});

	after(async () => {
		await rm(APPEND_PATH, { force: true });
	});

	it('writes the first entry to a new file', async () => {
		await appendHistory('first', APPEND_PATH);
		const content = await readFile(APPEND_PATH, 'utf8');
		assert.equal(content, 'first\n');
	});

	it('appends subsequent entries chronologically', async () => {
		await appendHistory('second', APPEND_PATH);
		await appendHistory('third', APPEND_PATH);
		const content = await readFile(APPEND_PATH, 'utf8');
		assert.equal(content, 'first\nsecond\nthird\n');
	});

	it('collapses an identical consecutive entry', async () => {
		await appendHistory('third', APPEND_PATH); // same as the last one
		const content = await readFile(APPEND_PATH, 'utf8');
		assert.equal(content, 'first\nsecond\nthird\n'); // unchanged
	});

	it('appends again after a different entry breaks the streak', async () => {
		await appendHistory('fourth', APPEND_PATH);
		await appendHistory('third', APPEND_PATH); // no longer consecutive dup
		const content = await readFile(APPEND_PATH, 'utf8');
		assert.equal(content, 'first\nsecond\nthird\nfourth\nthird\n');
	});

	it('ignores empty / whitespace-only input', async () => {
		const before = await readFile(APPEND_PATH, 'utf8');
		await appendHistory('', APPEND_PATH);
		await appendHistory('   ', APPEND_PATH);
		await appendHistory('\t\n', APPEND_PATH);
		const after = await readFile(APPEND_PATH, 'utf8');
		assert.equal(after, before);
	});

	it('caps the file at HISTORY_MAX entries (drops oldest)', async () => {
		const capPath = join(BASE, 'cap-history');
		// Write HISTORY_MAX + 3 entries; only the last HISTORY_MAX should remain.
		for (let i = 0; i < HISTORY_MAX + 3; i++) {
			await appendHistory(`cmd-${i}`, capPath);
		}
		const lines = await loadHistory(capPath);
		assert.equal(lines.length, HISTORY_MAX);
		assert.equal(lines[0], `cmd-3`); // 0, 1, 2 dropped
		assert.equal(lines[lines.length - 1], `cmd-${HISTORY_MAX + 2}`);
		await rm(capPath, { force: true });
	});

	it('creates the parent directory if missing', async () => {
		const nested = join(BASE, 'a', 'b', 'history');
		await appendHistory('hello', nested);
		const content = await readFile(nested, 'utf8');
		assert.equal(content, 'hello\n');
		await rm(join(BASE, 'a'), { recursive: true, force: true });
	});
});
