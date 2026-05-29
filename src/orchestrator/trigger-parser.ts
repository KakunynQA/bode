export type BodeTrigger = {
	command: 'plan' | 'fix' | 'review';
	flags: string[];
};

export function parseBodeTrigger(input: string): BodeTrigger | null {
	const trimmed = input.trim();
	const match = trimmed.match(/^\/bode\s+(plan|fix|review)(?:\s+(.*))?$/);
	if (!match) return null;
	return {
		command: match[1] as BodeTrigger['command'],
		flags: match[2]?.split(/\s+/).filter(Boolean) ?? [],
	};
}
