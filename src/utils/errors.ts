/**
 * Standardized error formatting (#17).
 *
 * Bode errors should answer three questions on a single read:
 *   1. WHAT failed.
 *   2. WHERE it failed (file / config key / command).
 *   3. WHAT to do next (the action sentence prefixed with `→`).
 *
 * Use `errorWithHint(message, hint)` to format with a `→` next-step line.
 * Use `errorChecklist(message, items)` for multi-option fixes.
 *
 * Adapters and command handlers SHOULD prefer these helpers over raw
 * `new Error(...)` so the user-facing surface stays consistent.
 */

export function errorWithHint(message: string, hint: string): Error {
	return new Error(`${message}\n  → ${hint}`);
}

export function errorChecklist(message: string, items: string[]): Error {
	const bullets = items.map((i) => `    - ${i}`).join('\n');
	return new Error(`${message}\n  Checklist:\n${bullets}`);
}

export function missingConfigError(key: string, hint: string): Error {
	return errorWithHint(`Missing config: ${key}`, hint);
}

export function unknownAdapterError(kind: string, name: string, available: string[]): Error {
	return errorWithHint(
		`Unknown ${kind} adapter: "${name}"`,
		`Available: ${available.join(', ')}. Or check spelling.`
	);
}
