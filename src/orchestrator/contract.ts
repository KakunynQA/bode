export type PhaseContract = {
	objective: string;
	depends_on: string[];
	files: Array<{ path: string; reason?: string }>;
	validation: string[];
	expected_output: string[];
	risk: string;
};

export type ContractValidation =
	| { ok: true; contract: PhaseContract }
	| { ok: false; errors: string[] };

const REQUIRED_FIELDS = [
	'objective',
	'depends_on',
	'files',
	'validation',
	'expected_output',
	'risk',
];

export function extractYamlContract(markdown: string): string | null {
	const fence = markdown.match(/```yaml\s*([\s\S]*?)```/i);
	if (fence?.[1]) return fence[1].trim();
	const frontmatter = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
	return frontmatter?.[1]?.trim() ?? null;
}

export function validateContract(markdown: string): ContractValidation {
	const yaml = extractYamlContract(markdown);
	if (!yaml) return { ok: false, errors: ['Missing YAML contract block'] };

	const errors: string[] = [];
	for (const field of REQUIRED_FIELDS) {
		if (!new RegExp(`^${field}:`, 'm').test(yaml)) errors.push(`Missing field: ${field}`);
	}

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		contract: {
			objective: readScalar(yaml, 'objective') ?? '',
			depends_on: readList(yaml, 'depends_on'),
			files: readFileList(yaml),
			validation: readList(yaml, 'validation'),
			expected_output: readList(yaml, 'expected_output'),
			risk: readScalar(yaml, 'risk') ?? '',
		},
	};
}

function readScalar(yaml: string, key: string): string | null {
	const match = yaml.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]*)["']?`, 'm'));
	return match?.[1]?.trim() ?? null;
}

function readList(yaml: string, key: string): string[] {
	const block = yaml.match(new RegExp(`^${key}:\\s*\\n([\\s\\S]*?)(?=^[a-zA-Z_]+:|\\z)`, 'm'));
	if (!block?.[1]) return [];
	return block[1]
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('- '))
		.map((line) =>
			line
				.slice(2)
				.trim()
				.replace(/^['"]|['"]$/g, '')
		);
}

function readFileList(yaml: string): Array<{ path: string; reason?: string }> {
	return readList(yaml, 'files').map((path) => ({ path }));
}
