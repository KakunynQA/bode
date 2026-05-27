import pc from 'picocolors';
import {
	isTelemetryEnabled,
	setTelemetryEnabled,
	readRecentEvents,
	__testing,
} from '~/utils/telemetry.ts';

export async function telemetryAction(subcommand: string | undefined): Promise<void> {
	const cmd = subcommand?.toLowerCase() ?? 'status';

	switch (cmd) {
		case 'on':
		case 'enable': {
			const s = await setTelemetryEnabled(true);
			console.log(pc.green('✓ Telemetry enabled.'));
			console.log(pc.dim(`  Machine ID: ${s.machineId}`));
			console.log(pc.dim(`  Events log: ${__testing.EVENTS_FILE}`));
			console.log(pc.dim('  Default endpoint: none (local-only). Set telemetry.endpoint in'));
			console.log(pc.dim('  config to forward events to your own collector.'));
			console.log('');
			console.log(pc.bold('What gets recorded:'));
			console.log(pc.dim('  command name, success/failure, duration, tracker kind, CLI adapter,'));
			console.log(pc.dim('  bode version, Node version, platform, machine UUID.'));
			console.log(pc.bold('What never gets recorded:'));
			console.log(pc.dim('  task content, ticket IDs, code, paths, credentials, your identity.'));
			break;
		}
		case 'off':
		case 'disable': {
			await setTelemetryEnabled(false);
			console.log(pc.yellow('Telemetry disabled. Recorded events remain on disk.'));
			console.log(pc.dim(`  To delete them: rm -rf ${__testing.TELEMETRY_DIR}`));
			break;
		}
		case 'status': {
			const enabled = await isTelemetryEnabled();
			console.log(enabled ? pc.green('Telemetry: ENABLED') : pc.dim('Telemetry: disabled'));
			console.log(pc.dim(`  Storage: ${__testing.TELEMETRY_DIR}`));
			console.log(pc.dim(`  Toggle: bode telemetry on   |   bode telemetry off`));
			console.log(pc.dim(`  Preview: bode telemetry preview`));
			break;
		}
		case 'preview': {
			const events = await readRecentEvents(20);
			if (events.length === 0) {
				console.log(pc.dim('No telemetry events recorded yet.'));
				return;
			}
			console.log(pc.bold(`Last ${events.length} events:`));
			for (const e of events) {
				const status = e.success ? pc.green('✓') : pc.red('✗');
				const dur = e.duration_ms ? pc.dim(` (${e.duration_ms}ms)`) : '';
				console.log(
					`  ${status} ${pc.cyan(e.command.padEnd(12))} ${pc.dim(e.ts)} ${pc.dim(`v${e.bode_version}`)}${dur}`
				);
			}
			break;
		}
		default:
			console.error(pc.red(`Unknown subcommand: ${cmd}`));
			console.error(pc.dim('Usage: bode telemetry [on|off|status|preview]'));
			process.exit(1);
	}
}
