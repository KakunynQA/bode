import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
	isTelemetryEnabled,
	setTelemetryEnabled,
	recordEvent,
	readRecentEvents,
	__testing,
} from '~/utils/telemetry.ts';

describe('telemetry — opt-in by default', () => {
	beforeEach(async () => {
		await rm(__testing.TELEMETRY_DIR, { recursive: true, force: true });
	});

	after(async () => {
		await rm(__testing.TELEMETRY_DIR, { recursive: true, force: true });
	});

	it('isTelemetryEnabled is false on a fresh install', async () => {
		assert.equal(await isTelemetryEnabled(), false);
	});

	it('setTelemetryEnabled(true) creates state file with a machineId', async () => {
		const s = await setTelemetryEnabled(true);
		assert.equal(s.enabled, true);
		assert.ok(s.machineId);
		assert.ok(s.enabledAt);
		assert.equal(await isTelemetryEnabled(), true);
	});

	it('disable preserves machineId', async () => {
		const s1 = await setTelemetryEnabled(true);
		const s2 = await setTelemetryEnabled(false);
		assert.equal(s2.machineId, s1.machineId);
		assert.equal(await isTelemetryEnabled(), false);
	});

	it('recordEvent is a silent no-op when disabled', async () => {
		await recordEvent({ command: 'doctor', success: true }, '0.27.0');
		// no file should be created
		assert.equal(existsSync(__testing.EVENTS_FILE), false);
	});

	it('recordEvent appends NDJSON when enabled', async () => {
		await setTelemetryEnabled(true);
		await recordEvent({ command: 'doctor', success: true, duration_ms: 42 }, '0.27.0');
		const raw = await readFile(__testing.EVENTS_FILE, 'utf-8');
		const line = raw.trim().split('\n')[0]!;
		const parsed = JSON.parse(line);
		assert.equal(parsed.command, 'doctor');
		assert.equal(parsed.success, true);
		assert.equal(parsed.duration_ms, 42);
		assert.equal(parsed.bode_version, '0.27.0');
		assert.ok(parsed.machine_id);
	});

	it('readRecentEvents returns the last N entries', async () => {
		await setTelemetryEnabled(true);
		for (let i = 0; i < 5; i++) {
			await recordEvent({ command: 'cmd' + i, success: true }, '0.27.0');
		}
		const got = await readRecentEvents(3);
		assert.equal(got.length, 3);
		assert.equal(got[got.length - 1]?.command, 'cmd4');
	});
});
