export interface CliModels {
	name: string;
	models: string[];
}

const CLI_MODELS: CliModels[] = [
	{
		name: 'claude-code',
		models: [
			'claude-opus-4-7',
			'claude-sonnet-4-6',
			'claude-opus-4-6',
			'claude-opus-4-5',
			'claude-haiku-4-5',
		],
	},
	{
		name: 'opencode',
		models: [
			'claude-opus-4-7',
			'claude-sonnet-4-6',
			'claude-opus-4-6',
			'claude-opus-4-5',
			'claude-haiku-4-5',
			'gpt-5.5',
			'gpt-5.4',
			'gpt-5.4-mini',
			'gpt-5.3-codex',
			'gpt-5.3-codex-spark',
			'glm-5.1',
			'glm-5-turbo',
			'glm-5',
			'glm-4.7-flash',
			'glm-4.7',
		],
	},
	{
		name: 'codex',
		models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.3-codex-spark'],
	},
];

export function getModelsForCli(cliName: string): string[] {
	const entry = CLI_MODELS.find((c) => c.name === cliName);
	return entry?.models ?? [];
}

export function getAllCliModelEntries(): CliModels[] {
	return CLI_MODELS;
}
