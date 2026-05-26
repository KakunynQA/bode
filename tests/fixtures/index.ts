export const providers = [
	{
		id: 'anthropic',
		name: 'Anthropic',
		models: [
			{ id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
			{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
		],
	},
	{
		id: 'openai',
		name: 'OpenAI',
		models: [{ id: 'gpt-5', name: 'GPT-5' }],
	},
];

export const agents = [
	{ id: 'build', name: 'Build', description: 'Default coding agent' },
	{ id: 'plan', name: 'Plan', description: 'Planning agent, read-only' },
];

export const sessions = [
	{
		id: 'sess_1',
		title: 'Add user auth flow',
		createdAt: Date.now() - 3600_000,
		updatedAt: Date.now() - 600_000,
	},
	{
		id: 'sess_2',
		title: 'Fix SSE reconnection bug',
		createdAt: Date.now() - 7200_000,
		updatedAt: Date.now() - 1200_000,
	},
];
