import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FALLBACK_VERSION = '0.0.0-dev';

function moduleDir(): string | null {
	if (typeof __dirname !== 'undefined') return __dirname;
	try {
		return dirname(fileURLToPath(import.meta.url));
	} catch {
		return null;
	}
}

export function getVersion(): string {
	if (typeof __VERSION__ !== 'undefined' && __VERSION__) {
		return __VERSION__;
	}

	const base = moduleDir();
	if (base) {
		const candidates = [join(base, '..', '..', 'package.json'), join(base, '..', 'package.json')];
		for (const path of candidates) {
			if (existsSync(path)) {
				try {
					const pkg = JSON.parse(readFileSync(path, 'utf-8')) as { version?: string };
					if (pkg.version) return pkg.version;
				} catch {
					// ignore and try next candidate
				}
			}
		}
	}

	return FALLBACK_VERSION;
}
