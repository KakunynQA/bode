import pc from 'picocolors';
import type { PermissionHit } from './output-scan.ts';

export function printPermissionWarning(hit: PermissionHit): void {
	console.log('');
	console.log(pc.yellow(`⚠ CLI output mentions a permission/access issue (${hit.pattern}).`));

	if (hit.suggestedPaths.length > 0) {
		console.log(pc.dim('  Paths referenced:'));
		for (const p of hit.suggestedPaths) {
			console.log(pc.dim(`    - ${p}`));
		}
	}

	console.log(pc.dim('  Snippet:'));
	for (const line of hit.snippet.split('\n')) {
		console.log(pc.dim(`    > ${line}`));
	}

	console.log('');
	console.log(pc.dim('  Options:'));
	console.log(pc.dim('    - Grant access to the listed paths and rerun the phase'));
	console.log(pc.dim('    - Remove the unreachable path from your project config'));
	console.log(pc.dim('    - Run "bode show <phase> <KEY>" to inspect the full artifact'));
	console.log('');
}
