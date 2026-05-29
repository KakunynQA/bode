import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBodeTrigger } from '~/orchestrator/trigger-parser.ts';

describe('parseBodeTrigger', () => {
	it('parses plan trigger', () => {
		assert.deepEqual(parseBodeTrigger('/bode plan --auto'), {
			command: 'plan',
			flags: ['--auto'],
		});
	});

	it('rejects unrelated comments', () => {
		assert.equal(parseBodeTrigger('please fix'), null);
	});
});
