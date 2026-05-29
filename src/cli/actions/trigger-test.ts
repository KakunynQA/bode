import { readFile } from 'node:fs/promises';
import pc from 'picocolors';
import { parseBodeTrigger } from '~/orchestrator/trigger-parser.ts';

export async function triggerTestAction(payloadPath: string): Promise<void> {
	const raw = await readFile(payloadPath, 'utf-8');
	const payload = JSON.parse(raw) as { comment?: { body?: string } };
	const parsed = parseBodeTrigger(payload.comment?.body ?? '');
	if (!parsed) {
		console.log(pc.yellow('No bode trigger found.'));
		return;
	}
	console.log(JSON.stringify(parsed, null, 2));
}
