import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultsDir = resolve(root, 'src', 'skills', 'defaults');

function wrapClaude(name, neutral) {
	return [
		`# Skill: ${name}`,
		'',
		'<role>',
		'Follow the instructions exactly.',
		'Do not add a preamble before the requested artifact.',
		'</role>',
		'',
		'<instructions>',
		neutral.trim(),
		'',
		'</instructions>',
		'',
		'<output-policy>',
		'Write only the requested markdown artifact.',
		'If a handoff path is present, write the artifact there and exit.',
		'</output-policy>',
		'',
	].join('\n');
}

function wrapOpenAi(name, neutral) {
	return [
		`# Skill: ${name}`,
		'',
		'You are operating as the system-directed coding assistant for this bode phase.',
		'Follow the task contract, produce the requested structured markdown, and avoid introductory commentary.',
		'',
		'## Instructions',
		'',
		neutral.trim(),
		'',
		'## Output Policy',
		'',
		'- Return only the requested artifact content.',
		'- Use explicit headings and checklists exactly as requested.',
		'- If a handoff path is present, write the artifact there and exit.',
		'',
	].join('\n');
}

mkdirSync(defaultsDir, { recursive: true });

for (const file of readdirSync(defaultsDir)) {
	if (!file.endsWith('.neutral.md')) continue;
	const skill = file.slice(0, -'.neutral.md'.length);
	const neutral = readFileSync(resolve(defaultsDir, file), 'utf-8');
	const title = skill
		.split('-')
		.map((s) => s[0]?.toUpperCase() + s.slice(1))
		.join(' ');
	writeFileSync(resolve(defaultsDir, `${skill}.claude.md`), wrapClaude(title, neutral));
	writeFileSync(resolve(defaultsDir, `${skill}.openai.md`), wrapOpenAi(title, neutral));
	writeFileSync(resolve(defaultsDir, `${skill}.md`), neutral);
}

console.log('Built skill flavors from neutral sources.');
