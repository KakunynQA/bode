import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { getRunDir } from '~/config/defaults.ts';

describe('run manifest', () => {
	it('records prompt hashes and exports a portable bundle', async () => {
		const taskKey = `TEST-${Date.now()}`;
		try {
			const { recordManifestPhase, readManifest, exportRunBundle } =
				await import('~/orchestrator/run-manifest.ts');
			await recordManifestPhase({
				taskKey,
				phase: 'planning',
				prompt: 'prompt',
				skillContent: 'skill',
				cli: 'opencode',
				model: 'model-x',
			});
			const manifest = await readManifest(taskKey);
			assert.equal(manifest.phases[0]?.phase, 'planning');
			assert.equal(manifest.phases[0]?.prompt_sha256.length, 64);
			const bundle = JSON.parse(await exportRunBundle(taskKey)) as {
				files: Record<string, string>;
			};
			assert.ok(bundle.files['manifest.json']);
		} finally {
			await rm(getRunDir(taskKey), { recursive: true, force: true });
		}
	});
});
