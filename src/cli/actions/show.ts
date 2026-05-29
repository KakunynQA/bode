import { getRunDir } from '~/config/defaults.ts';
import { readText } from '~/utils/fs.ts';
import { renderArtifactHtml } from '~/orchestrator/html-renderer.ts';
import { getTaskCost } from '~/orchestrator/budget-tracker.ts';
import { writeText } from '~/utils/fs.ts';
import pc from 'picocolors';

const VALID_ARTIFACTS = ['plan', 'planning', 'implementation', 'review'] as const;

export async function showAction(
	artifact: string,
	taskKey: string,
	options: { html?: boolean } = {}
): Promise<void> {
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

	if (options.html) {
		const htmlPath = `${getRunDir(taskKey)}/${filename.replace(/\.md$/, '.html')}`;
		await writeText(htmlPath, renderArtifactHtml(`${taskKey} ${artifact}`, content));
		console.log(htmlPath);
		return;
	}

	const cost = await getTaskCost(taskKey);
	console.log(pc.dim(`${taskKey.toUpperCase()} ${normalized} | cost so far ~$${cost.toFixed(2)}`));
	console.log('');
	console.log(content);
}
