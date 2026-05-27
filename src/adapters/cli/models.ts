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
      'claude-sonnet-4-20250514',
      'claude-haiku-4-20250414',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
    ],
  },
  {
    name: 'opencode',
    models: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-20250414',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'o3',
      'o4-mini',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ],
  },
  {
    name: 'codex',
    models: [
      'o3',
      'o4-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
    ],
  },
  {
    name: 'zai',
    models: [
      'glm-5.1',
      'glm-4.1',
      'glm-4.1-thinking',
      'glm-4.1v',
      'glm-4.1v-thinking',
    ],
  },
];

export function getModelsForCli(cliName: string): string[] {
  const entry = CLI_MODELS.find((c) => c.name === cliName);
  return entry?.models ?? [];
}

export function getAllCliModelEntries(): CliModels[] {
  return CLI_MODELS;
}
