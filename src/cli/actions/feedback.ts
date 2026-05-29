import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import pc from 'picocolors';
import { getVersion } from '~/utils/version.ts';

export type FeedbackOptions = {
	title?: string;
	open?: boolean;
};

export function buildFeedbackUrl(options: FeedbackOptions = {}): string {
	const title = options.title ?? 'Bode feedback';
	const body = [
		'## Feedback',
		'',
		'<Tell us what worked, what failed, or what would make Bode useful for your team.>',
		'',
		'## Environment',
		'',
		`- Bode version: ${getVersion()}`,
		`- OS: ${platform()}`,
		'- AI CLI: <claude-code | opencode | codex | unknown>',
		'- Tracker: <jira | github-issues | linear | notion | trello | local | unknown>',
		'',
		'## Privacy',
		'',
		'Please remove secrets, private code, tokens, customer names, and internal URLs before submitting.',
	].join('\n');
	const params = new URLSearchParams({ title, body, labels: 'feedback' });
	return `https://github.com/KakunynQA/bode/issues/new?${params.toString()}`;
}

export async function feedbackAction(options: FeedbackOptions = {}): Promise<void> {
	const url = buildFeedbackUrl(options);
	console.log(url);
	console.log(
		pc.dim('Bode never auto-submits feedback. Review and edit the issue before posting.')
	);
	if (options.open) openUrl(url);
}

function openUrl(url: string): void {
	const command =
		process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
	const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
	execFile(command, args, { windowsHide: true }, () => undefined);
}
