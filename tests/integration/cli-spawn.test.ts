import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BaseCliAdapter } from '~/adapters/cli/base.ts';
import type { CliAdapterConfig, CliInvocationOptions } from '~/types/cli-adapter.ts';

const fixturePath = resolve('tests', 'fixtures', 'bin', 'fake-ai-cli.mjs');

class FakeAdapter extends BaseCliAdapter {
	readonly name = 'fake';
	extraArgs: string[] = [];

	getCommand() {
		return 'node';
	}

	buildArgs(_prompt: string, _config: CliAdapterConfig, _options: CliInvocationOptions): string[] {
		return [fixturePath, ...this.extraArgs];
	}
}

function makeConfig(overrides?: Partial<CliAdapterConfig>): CliAdapterConfig {
	return {
		cli: 'fake',
		model: 'test-model',
		timeout_minutes: 1,
		...overrides,
	};
}

describe('BaseCliAdapter spawn (integration)', () => {
	it('captures stdout and exits 0 on happy path', async () => {
		const adapter = new FakeAdapter();
		const result = await adapter.invoke('do something', makeConfig());
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.match(result.value.stdout, /completed successfully/);
		assert.equal(result.value.stderr, '');
		assert.equal(result.value.exitCode, 0);
	});

	it('captures stderr and exits 1 on --fail', async () => {
		const adapter = new FakeAdapter();
		adapter.extraArgs = ['--fail'];
		const result = await adapter.invoke('do something', makeConfig());
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.match(result.value.stderr, /something went wrong/);
		assert.equal(result.value.exitCode, 1);
	});

	it('returns error on timeout', async () => {
		const adapter = new FakeAdapter();
		adapter.extraArgs = ['--timeout'];
		const result = await adapter.invoke('do something', makeConfig({ timeout_minutes: 0.001 }));
		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.error.message, /timeout/i);
	});

	it('populates durationMs > 0', async () => {
		const adapter = new FakeAdapter();
		const result = await adapter.invoke('do something', makeConfig());
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.ok(result.value.durationMs > 0);
	});

	it('captures both stdout and stderr', async () => {
		const adapter = new FakeAdapter();
		const result = await adapter.invoke('hello world', makeConfig());
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.ok(typeof result.value.stdout === 'string');
		assert.ok(typeof result.value.stderr === 'string');
	});

	it('returns error on AbortSignal', async () => {
		const adapter = new FakeAdapter();
		adapter.extraArgs = ['--timeout'];
		const controller = new AbortController();
		const result = adapter.invoke('do something', makeConfig(), { signal: controller.signal });
		setTimeout(() => controller.abort(), 50);
		const r = await result;
		assert.equal(r.ok, false);
		if (r.ok) return;
		assert.match(r.error.message, /abort/i);
	});

	it('creates artifact when --artifact is passed', async () => {
		const adapter = new FakeAdapter();
		const dir = mkdtempSync(join(tmpdir(), 'bode-test-artifact-'));
		const file = 'plan.md';
		adapter.extraArgs = ['--artifact', dir, file];
		try {
			const result = await adapter.invoke('write a plan', makeConfig());
			assert.equal(result.ok, true);
			if (!result.ok) return;
			assert.equal(result.value.exitCode, 0);
			assert.match(result.value.stdout, /completed successfully/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('isAvailable returns true for the fixture binary', async () => {
		const adapter = new FakeAdapter();
		const available = await adapter.isAvailable();
		assert.equal(available, true);
	});

	it('isAvailable returns false for nonexistent command', async () => {
		class BadAdapter extends BaseCliAdapter {
			readonly name = 'bad';
			getCommand() {
				return 'this-command-does-not-exist-xyz-12345';
			}
			buildArgs() {
				return [];
			}
		}
		const adapter = new BadAdapter();
		const available = await adapter.isAvailable();
		assert.equal(available, false);
	});
});
