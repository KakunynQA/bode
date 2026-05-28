export const BODE_ERROR_KINDS = [
	'config',
	'tracker',
	'phase',
	'adapter',
	'timeout',
	'network',
	'storage',
	'validation',
] as const;

export type BodeErrorKind = (typeof BODE_ERROR_KINDS)[number];

export type BodeError =
	| { kind: 'config'; code: string; message: string; hint?: string }
	| { kind: 'tracker'; code: string; message: string; provider: string }
	| { kind: 'phase'; code: string; message: string; phase: string }
	| { kind: 'adapter'; code: string; message: string; adapter: string }
	| { kind: 'timeout'; code: string; message: string; ms: number }
	| { kind: 'network'; code: string; message: string; status?: number }
	| { kind: 'storage'; code: string; message: string; path: string }
	| { kind: 'validation'; code: string; message: string; issues: string[] };

export function isBodeError(error: unknown): error is BodeError {
	if (typeof error !== 'object' || error === null) return false;
	const obj = error as Record<string, unknown>;
	if (typeof obj['kind'] !== 'string') return false;
	return (BODE_ERROR_KINDS as readonly string[]).includes(obj['kind']);
}

export function bodeErrorToError(err: BodeError): Error {
	const tag = `[${err.kind}:${err.code}]`;
	const parts: string[] = [tag, err.message];

	if ('hint' in err && typeof err.hint === 'string') {
		parts.push(`Hint: ${err.hint}`);
	}

	if ('issues' in err && Array.isArray(err.issues) && err.issues.length > 0) {
		parts.push(`Issues: ${err.issues.join('; ')}`);
	}

	return new Error(parts.join(' '));
}

export function errorToBodeError(error: Error | BodeError): BodeError {
	if (isBodeError(error)) return error;

	const msg = error.message.toLowerCase();

	if (msg.includes('config') || msg.includes('yaml') || msg.includes('schema')) {
		return { kind: 'config', code: 'unknown', message: error.message };
	}

	if (msg.includes('timeout') || msg.includes('timed out')) {
		return { kind: 'timeout', code: 'unknown', message: error.message, ms: 0 };
	}

	if (
		msg.includes('network') ||
		msg.includes('econnrefused') ||
		msg.includes('enotfound') ||
		msg.includes('fetch')
	) {
		return { kind: 'network', code: 'unknown', message: error.message };
	}

	if (msg.includes('enoent') || msg.includes('eacces') || msg.includes('permission')) {
		return { kind: 'storage', code: 'unknown', message: error.message, path: 'unknown' };
	}

	return { kind: 'phase', code: 'unknown', message: error.message, phase: 'unknown' };
}
