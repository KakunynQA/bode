/**
 * Opt-in telemetry (#20).
 *
 * Default: OFF. User must run `bode telemetry on` to enable.
 *
 * What gets recorded (when enabled):
 *   - command name (`start`, `continue`, `done`, `doctor`, ...)
 *   - success / failure
 *   - duration ms
 *   - tracker kind in use (jira / github-issues / linear / notion / trello / local)
 *   - CLI adapter in use per phase (claude-code / opencode / codex)
 *   - bode version + Node version + platform
 *
 * What NEVER gets recorded:
 *   - task content / summaries / descriptions
 *   - ticket IDs / keys
 *   - code / diffs / file paths
 *   - API tokens / credentials
 *   - user identity (no email, no machine name)
 *
 * Storage: ~/.bode/telemetry/events.ndjson (append-only).
 *
 * Network: nothing leaves the machine by default. When the user configures
 * `telemetry.endpoint`, events POST to that URL in batches. Bode itself does
 * not host an endpoint — this is plumbing for someone who wants their own.
 *
 * Inspect what's stored: `bode telemetry preview`.
 */

import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TELEMETRY_DIR = join(homedir(), '.bode', 'telemetry');
const STATE_FILE = join(TELEMETRY_DIR, 'state.json');
const EVENTS_FILE = join(TELEMETRY_DIR, 'events.ndjson');

type TelemetryState = {
	enabled: boolean;
	machineId: string;
	enabledAt?: string;
};

export type TelemetryEvent = {
	ts: string;
	machine_id: string;
	bode_version: string;
	node_version: string;
	platform: NodeJS.Platform;
	command: string;
	success: boolean;
	duration_ms?: number;
	tracker_kind?: string;
	cli_adapter?: string;
};

async function readState(): Promise<TelemetryState | null> {
	if (!existsSync(STATE_FILE)) return null;
	try {
		const raw = await readFile(STATE_FILE, 'utf-8');
		return JSON.parse(raw) as TelemetryState;
	} catch {
		return null;
	}
}

async function writeState(state: TelemetryState): Promise<void> {
	await mkdir(TELEMETRY_DIR, { recursive: true });
	await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function isTelemetryEnabled(): Promise<boolean> {
	const state = await readState();
	return state?.enabled ?? false;
}

export async function setTelemetryEnabled(enabled: boolean): Promise<TelemetryState> {
	const existing = (await readState()) ?? {
		enabled: false,
		machineId: randomUUID(),
	};
	const next: TelemetryState = {
		...existing,
		enabled,
	};
	if (enabled) next.enabledAt = new Date().toISOString();
	await writeState(next);
	return next;
}

export async function recordEvent(
	event: Omit<TelemetryEvent, 'ts' | 'machine_id' | 'bode_version' | 'node_version' | 'platform'>,
	bodeVersion: string
): Promise<void> {
	const state = await readState();
	if (!state?.enabled) return;
	const full: TelemetryEvent = {
		ts: new Date().toISOString(),
		machine_id: state.machineId,
		bode_version: bodeVersion,
		node_version: process.versions.node,
		platform: process.platform,
		...event,
	};
	try {
		await mkdir(TELEMETRY_DIR, { recursive: true });
		await appendFile(EVENTS_FILE, JSON.stringify(full) + '\n', 'utf-8');
	} catch {
		// telemetry must never break bode
	}
}

export async function readRecentEvents(limit = 20): Promise<TelemetryEvent[]> {
	if (!existsSync(EVENTS_FILE)) return [];
	const raw = await readFile(EVENTS_FILE, 'utf-8');
	const lines = raw.trim().split('\n').slice(-limit);
	return lines
		.filter((l) => l.length > 0)
		.map((l) => {
			try {
				return JSON.parse(l) as TelemetryEvent;
			} catch {
				return null;
			}
		})
		.filter((e): e is TelemetryEvent => e !== null);
}

export const __testing = { TELEMETRY_DIR, STATE_FILE, EVENTS_FILE };
