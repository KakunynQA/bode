export type AdfNode = {
	type: string;
	version?: number;
	content?: AdfNode[];
	text?: string;
	marks?: { type: string }[];
	attrs?: Record<string, unknown>;
};

export function textToAdf(text: string): AdfNode {
	const paragraphs = text.split(/\n{2,}/);
	const content: AdfNode[] = paragraphs
		.filter((p) => p.length > 0)
		.map((p) => ({
			type: 'paragraph',
			content: [{ type: 'text', text: p }],
		}));

	if (content.length === 0) {
		content.push({ type: 'paragraph', content: [] });
	}

	return {
		type: 'doc',
		version: 1,
		content,
	};
}

export function adfToText(node: unknown): string {
	if (node === null || node === undefined) return '';
	if (typeof node === 'string') return node;
	if (typeof node !== 'object') return '';

	const n = node as AdfNode;
	if (n.type === 'text' && typeof n.text === 'string') {
		return n.text;
	}

	if (Array.isArray(n.content)) {
		const sep = n.type === 'paragraph' || n.type === 'heading' ? '\n\n' : '';
		return n.content.map((c) => adfToText(c)).join('') + sep;
	}

	return '';
}
