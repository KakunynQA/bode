type Env = { GITHUB_WEBHOOK_SECRET: string };

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
		const body = await request.text();
		const signature = request.headers.get('x-hub-signature-256') ?? '';
		if (!(await verifySignature(body, signature, env.GITHUB_WEBHOOK_SECRET))) {
			return new Response('invalid signature', { status: 401 });
		}
		const payload = JSON.parse(body) as { comment?: { body?: string } };
		const command = parseTrigger(payload.comment?.body ?? '');
		return Response.json({ accepted: Boolean(command), command });
	},
};

function parseTrigger(body: string): string | null {
	return /^\/bode\s+(plan|fix|review)(?:\s|$)/.test(body.trim()) ? body.trim() : null;
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
	const expected = `sha256=${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
	return expected === signature;
}
