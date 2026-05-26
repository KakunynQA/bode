import { sessions, providers, agents } from '../../fixtures/index.js';

export function startMockServer(port = 4097) {
	return Bun.serve({
		port,
		fetch(req: Request) {
			const url = new URL(req.url);

			if (url.pathname === '/global/health') {
				return Response.json({ healthy: true, version: 'mock-1.0.0' });
			}

			if (url.pathname === '/session' && req.method === 'GET') {
				return Response.json(sessions);
			}

			if (url.pathname === '/session' && req.method === 'POST') {
				const newSession = {
					id: `sess_${Date.now()}`,
					title: 'New Task',
					createdAt: Date.now(),
				};
				return Response.json(newSession);
			}

			if (url.pathname === '/session/status') {
				return Response.json(
					Object.fromEntries(sessions.map((s) => [s.id, { kind: 'idle' }]))
				);
			}

			if (url.pathname === '/provider') {
				return Response.json({
					all: providers,
					default: { anthropic: 'claude-opus-4-7' },
					connected: ['anthropic', 'openai'],
				});
			}

			if (url.pathname === '/agent') {
				return Response.json(agents);
			}

			if (url.pathname === '/event') {
				return new Response(new ReadableStream(), {
					headers: { 'content-type': 'text/event-stream' },
				});
			}

			if (url.pathname.startsWith('/session/') && url.pathname.endsWith('/message')) {
				return Response.json([]);
			}

			if (url.pathname.startsWith('/session/') && url.pathname.endsWith('/diff')) {
				return Response.json('');
			}

			if (url.pathname.startsWith('/session/') && req.method === 'POST') {
				return Response.json({ ok: true });
			}

			if (url.pathname.startsWith('/session/') && req.method === 'DELETE') {
				return Response.json({ ok: true });
			}

			return new Response('Not found', { status: 404 });
		},
	});
}
