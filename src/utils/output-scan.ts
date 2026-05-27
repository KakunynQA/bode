export type PermissionHit = {
	pattern: string;
	snippet: string;
	suggestedPaths: string[];
};

type PatternSpec = {
	name: string;
	re: RegExp;
};

const PERMISSION_PATTERNS: PatternSpec[] = [
	{ name: 'permission-denied', re: /\bpermission denied\b/i },
	{ name: 'eacces', re: /\bEACCES\b/ },
	{ name: 'no-read-access', re: /(?:do not|don'?t|need to)\s+have\s+(?:read\s+)?access/i },
	{ name: 'need-access', re: /need\s+(?:read\s+)?access\s+to/i },
	{ name: 'grant-permission', re: /(?:could you|please)\s+grant\s+(?:permission|access)/i },
	{ name: 'sandbox-blocked', re: /sandbox.*(?:blocked|refused|denied|restrict)/i },
	{ name: 'not-allowed', re: /not\s+allowed\s+to\s+(?:read|access)/i },
];

const PATH_RE = /(?:[A-Z]:[\\/][^\s`'"]+|\/[^\s`'"]+)/g;

export function detectPermissionIssue(output: string | undefined | null): PermissionHit | null {
	if (!output) return null;

	for (const { name, re } of PERMISSION_PATTERNS) {
		const match = output.match(re);
		if (!match) continue;

		const idx = match.index ?? 0;
		const start = Math.max(0, idx - 120);
		const end = Math.min(output.length, idx + 240);
		const snippet = output.slice(start, end).trim();

		const pathMatches = snippet.match(PATH_RE) ?? [];
		const suggestedPaths = Array.from(new Set(pathMatches));

		return { pattern: name, snippet, suggestedPaths };
	}

	return null;
}
