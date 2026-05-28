import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractYamlContract, validateContract } from '~/orchestrator/contract.ts';

describe('phase contract validation', () => {
	it('extracts fenced yaml contract', () => {
		const yaml = extractYamlContract('```yaml\nobjective: test\n```');
		assert.equal(yaml, 'objective: test');
	});

	it('rejects missing contract', () => {
		const result = validateContract('no yaml here');
		assert.equal(result.ok, false);
	});

	it('accepts required fields', () => {
		const result = validateContract(
			[
				'```yaml',
				'objective: "x"',
				'depends_on: []',
				'files: []',
				'validation:',
				'  - "npm test"',
				'expected_output:',
				'  - "works"',
				'risk: "low"',
				'```',
			].join('\n')
		);
		assert.equal(result.ok, true);
	});
});
