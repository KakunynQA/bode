import { getRunDir } from '~/config/defaults.ts';
import { readText } from '~/utils/fs.ts';
import pc from 'picocolors';

const VALID_ARTIFACTS = ['plan', 'planning', 'implementation', 'review'] as const;

export async function showAction(artifact: string, taskKey: string): Promise<void> {
	const normalized = artifact.toLowerCase();
	if (!VALID_ARTIFACTS.includes(normalized as (typeof VALID_ARTIFACTS)[number])) {
		console.error(pc.red(`Invalid artifact: "${artifact}". Valid: ${VALID_ARTIFACTS.join(', ')}`));
		process.exit(1);
	}

	let filename: string;
	switch (normalized) {
		case 'plan':
		case 'planning':
			filename = 'planning.md';
			break;
		case 'implementation':
			filename = 'implementation.md';
			break;
		case 'review':
			filename = 'review.md';
			break;
		default:
			filename = `${normalized}.md`;
	}

	const path = `${getRunDir(taskKey)}/${filename}`;
	const content = await readText(path);

	if (!content) {
		console.error(pc.yellow(`Artifact "${artifact}" not found for ${taskKey}`));
		process.exit(1);
	}

	console.log(content);
}
