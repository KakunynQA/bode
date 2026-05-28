import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BodeConfig, ProjectConfig } from '~/config/schema.ts';
import type { Result } from '~/types/result.ts';

export function runReleaseGate(options: {
	workdir: string;
	config: BodeConfig;
	projectConfig?: ProjectConfig;
}): Result<void> {
	const release = options.projectConfig?.release ?? options.config.release;
	if (!release) return { ok: true, value: undefined };

	const errors: string[] = [];
	if (release.require_version_bump) {
		const pkgPath = join(options.workdir, 'package.json');
		if (!existsSync(pkgPath)) errors.push('package.json is missing');
		else {
			const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
			if (!pkg.version) errors.push('package.json has no version');
		}
	}
	if (release.require_changelog_entry) {
		const changelogPath = join(options.workdir, 'CHANGELOG.md');
		if (!existsSync(changelogPath)) errors.push('CHANGELOG.md is missing');
		else if (!/^## \[[0-9]+\.[0-9]+\.[0-9]+\]/m.test(readFileSync(changelogPath, 'utf-8'))) {
			errors.push('CHANGELOG.md has no versioned entry');
		}
	}

	return errors.length > 0
		? { ok: false, error: new Error(errors.join('; ')) }
		: { ok: true, value: undefined };
}
