#!/usr/bin/env node
const args = process.argv.slice(2);
const flag = args[0] || 'success';

if (flag === 'create') {
	const urlMatch = args.find((a) => a.startsWith('--url='));
	if (urlMatch) {
		process.stdout.write(`Pull request URL: ${urlMatch.slice(6)}\n`);
	} else {
		process.stdout.write('Pull request URL: https://github.com/test/repo/pull/42\n');
	}
	process.exit(0);
}

if (flag === '--fail') {
	process.stderr.write('Error: Could not resolve to a Repository\n');
	process.exit(1);
}

process.stdout.write('gh version 2.42.0\n');
process.exit(0);
