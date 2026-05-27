import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK_VERSION = '0.0.0-dev';

export function getVersion(): string {
	if (typeof __VERSION__ !== 'undefined' && __VERSION__) {
		return __VERSION__;
	}

	if (typeof __dirname !== 'undefined') {
		const candidates = [
			join(__dirname, '..', '..', 'package.json'),
			join(__dirname, '..', 'package.json'),
		];
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
