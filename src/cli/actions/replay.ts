import { join } from 'node:path';
import pc from 'picocolors';
import { getAdapter } from '~/adapters/cli/registry.ts';
import { getRunDir } from '~/config/defaults.ts';
import { exportRunBundle, readManifest } from '~/orchestrator/run-manifest.ts';
import { ensureDir, readText, writeText } from '~/utils/fs.ts';

type ReplayOptions = {
	phase?: string;
	withCli?: string;
	withModel?: string;
	export?: string | boolean;
	import?: string;
};

export async function replayAction(taskKey: string, options: ReplayOptions): Promise<void> {
	if (options.import) {
		await importBundle(taskKey, options.import);
		return;
	}

	if (options.export) {
		const content = await exportRunBundle(taskKey);
		const target = typeof options.export === 'string' ? options.export : `${taskKey}.bode-run`;
		await writeText(target, content);
		console.log(target);
		return;
	}

	const manifest = await readManifest(taskKey);
	const phase = options.phase
		? manifest.phases.find((entry) => entry.phase === options.phase)
		: manifest.phases.at(-1);
	if (!phase) {
		console.error(pc.yellow(`No replay manifest phase found for ${taskKey}`));
		process.exit(1);
	}

	const prompt = await readText(join(getRunDir(taskKey), phase.prompt_path));
	if (!prompt) {
		console.error(pc.red(`Prompt artifact missing: ${phase.prompt_path}`));
		process.exit(1);
	}

	const cli = options.withCli ?? phase.cli;
	const model = options.withModel ?? phase.model;
	const adapter = getAdapter(cli);
	if (!adapter.ok) {
		console.error(pc.red(adapter.error.message));
		process.exit(1);
	}

	console.log(pc.bold(`Replaying ${taskKey.toUpperCase()} ${phase.phase}`));
	console.log(pc.dim(`cli=${cli} model=${model}`));
	const result = await adapter.value.invoke(
		prompt,
		{ cli, model, timeout_minutes: 60 },
		{ interactive: true }
	);
	if (!result.ok) {
		console.error(pc.red(result.error.message));
		process.exit(1);
	}
	await writeText(
		join(getRunDir(taskKey), `${phase.phase}.replay.log`),
		`STDOUT:\n${result.value.stdout}\n\nSTDERR:\n${result.value.stderr}`
	);
	if (result.value.exitCode !== 0) process.exit(result.value.exitCode);
}

async function importBundle(taskKey: string, bundlePath: string): Promise<void> {
	const raw = await readText(bundlePath);
	if (!raw) {
		console.error(pc.red(`Bundle not found: ${bundlePath}`));
		process.exit(1);
	}
	const bundle = JSON.parse(raw) as { files?: Record<string, string> };
	if (!bundle.files) {
		console.error(pc.red('Invalid .bode-run bundle'));
		process.exit(1);
	}
	const runDir = getRunDir(taskKey);
	await ensureDir(runDir);
	for (const [file, content] of Object.entries(bundle.files)) {
		await writeText(join(runDir, file), content);
	}
	console.log(pc.green(`Imported ${Object.keys(bundle.files).length} file(s) into ${runDir}`));
}
