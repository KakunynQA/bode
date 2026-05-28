#!/usr/bin/env node
const args = process.argv.slice(2);
const flag = args[0] || 'success';

if (flag === 'create') {
	process.stdout.write('Merge request URL: https://gitlab.com/test/repo/-/merge_requests/7\n');
	process.exit(0);
}

if (flag === '--fail') {
	process.stderr.write('Error: glab failed\n');
	process.exit(1);
}

process.stdout.write('glab version 1.42.0\n');
process.exit(0);
