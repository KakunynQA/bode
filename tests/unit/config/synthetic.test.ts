import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, rm } from 'node:fs/promises';
import { buildSyntheticConfig, isAutoDetectedConfig } from '~/config/loader.ts';

describe('buildSyntheticConfig (zero-config bootstrap, #7)', () => {
	it('returns a valid BodeConfig with all three phases', async () => {
		const tmpWorkdir = join(tmpdir(), 'bode-synthetic-' + Date.now());
		await mkdir(tmpWorkdir, { recursive: true });
		try {
			const cfg = await buildSyntheticConfig(tmpWorkdir);
			assert.ok(cfg.phases.planning.cli);
			assert.ok(cfg.phases.implementation.cli);
			assert.ok(cfg.phases.review.cli);
			// All phases use the same CLI in synthetic mode
			assert.equal(cfg.phases.planning.cli, cfg.phases.implementation.cli);
			assert.equal(cfg.phases.planning.cli, cfg.phases.review.cli);
		} finally {
			await rm(tmpWorkdir, { recursive: true, force: true });
		}
	});

	it('synthetic config has reasonable timeouts', async () => {
		const cfg = await buildSyntheticConfig(tmpdir());
		assert.ok(cfg.phases.planning.timeout_minutes >= 1);
		assert.ok(cfg.phases.implementation.timeout_minutes >= 1);
		assert.ok(cfg.phases.review.timeout_minutes >= 1);
	});

	it('synthetic config has a valid model string per CLI', async () => {
		const cfg = await buildSyntheticConfig(tmpdir());
		const validModelPrefixes = ['claude-', 'gpt-', 'glm-', 'o1-', 'o3-'];
		assert.ok(
			validModelPrefixes.some((p) => cfg.phases.planning.model.startsWith(p)),
			`got: ${cfg.phases.planning.model}`
		);
	});
});

describe('isAutoDetectedConfig', () => {
	it('returns false for plain configs', async () => {
		const cfg = await buildSyntheticConfig(tmpdir());
		// buildSyntheticConfig itself doesn't mark; the loader does.
		assert.equal(isAutoDetectedConfig(cfg), false);
	});

	it('returns true when the marker is set', async () => {
		const cfg = await buildSyntheticConfig(tmpdir());
		Object.defineProperty(cfg, '__autoDetected', {
			value: true,
			enumerable: false,
			configurable: true,
		});
		assert.equal(isAutoDetectedConfig(cfg), true);
	});
});
