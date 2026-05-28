import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';

import { RealJiraAdapter } from '~/adapters/jira/rest.ts';

const PORT = 19837;
const SITE = `http://localhost:${PORT}`;
const EMAIL = 'test@example.com';
const TOKEN = 'fake-api-token';

let server: Server;
let adapter: RealJiraAdapter;

type RouteHandler = (req: IncomingMessage, res: ServerResponse, body: string) => void;
let routeHandler: RouteHandler;

function collectBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		req.on('data', (c: Buffer) => chunks.push(c));
		req.on('end', () => resolve(Buffer.concat(chunks).toString()));
	});
}

function jsonRes(res: ServerResponse, status: number, data: unknown) {
	const payload = JSON.stringify(data);
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(payload),
	});
	res.end(payload);
}

function basicAuthOk(req: IncomingMessage): boolean {
	const header = req.headers.authorization;
	if (!header) return false;
	const match = /^Basic (.+)$/.exec(header);
	if (!match) return false;
	const decoded = Buffer.from(match[1], 'base64').toString();
	return decoded === `${EMAIL}:${TOKEN}`;
}

function createFakeJiraServer(): Promise<Server> {
	const s = createServer((req, res) => {
		if (!basicAuthOk(req)) {
			jsonRes(res, 401, { errorMessages: ['Unauthorized'] });
			return;
		}
		collectBody(req).then((body) => {
			routeHandler(req, res, body);
		});
	});
	return new Promise((resolve) => s.listen(PORT, () => resolve(s)));
}

const ADF_DESCRIPTION = {
	type: 'doc',
	version: 1,
	content: [
		{
			type: 'paragraph',
			content: [{ type: 'text', text: 'Hello world' }],
		},
	],
};

const JIRA_ISSUE_ADF = {
	key: 'TEST-1',
	fields: {
		summary: 'Test issue',
		description: ADF_DESCRIPTION,
		status: { name: 'In Progress' },
		issuetype: { name: 'Story' },
		assignee: { displayName: 'Test User' },
		labels: ['bug'],
	},
};

const JIRA_ISSUE_STRING_DESC = {
	key: 'TEST-2',
	fields: {
		summary: 'Plain desc',
		description: 'plain text description',
		status: { name: 'To Do' },
		issuetype: { name: 'Task' },
		assignee: null,
		labels: [],
	},
};

const TRANSITIONS_RESPONSE = {
	transitions: [
		{ id: '31', name: 'Done', to: { name: 'Done' } },
		{ id: '21', name: 'In Progress', to: { name: 'In Progress' } },
	],
};

describe('RealJiraAdapter (integration)', () => {
	before(async () => {
		routeHandler = () => {
			throw new Error('no route handler set');
		};
		server = await createFakeJiraServer();
		adapter = new RealJiraAdapter(SITE, EMAIL, TOKEN, 5000);
	});

	after((_, done) => {
		server.close(() => done());
	});

	it('fetchTask with ADF description', async () => {
		routeHandler = (req, res) => {
			assert.equal(req.method, 'GET');
			assert.match(req.url, /\/rest\/api\/3\/issue\/TEST-1$/);
			jsonRes(res, 200, JIRA_ISSUE_ADF);
		};

		const result = await adapter.fetchTask('TEST-1');
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.value.key, 'TEST-1');
		assert.equal(result.value.summary, 'Test issue');
		assert.equal(result.value.description, 'Hello world');
		assert.equal(result.value.status, 'In Progress');
		assert.equal(result.value.issueType, 'Story');
		assert.equal(result.value.assignee, 'Test User');
		assert.deepEqual(result.value.labels, ['bug']);
		assert.equal(result.value.url, `${SITE}/browse/TEST-1`);
	});

	it('fetchTask with string description', async () => {
		routeHandler = (req, res) => {
			assert.equal(req.method, 'GET');
			assert.match(req.url, /\/rest\/api\/3\/issue\/TEST-2$/);
			jsonRes(res, 200, JIRA_ISSUE_STRING_DESC);
		};

		const result = await adapter.fetchTask('TEST-2');
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.value.description, 'plain text description');
	});

	it('fetchTask 404 returns error', async () => {
		routeHandler = (_req, res) => {
			jsonRes(res, 404, { errorMessages: ['Issue does not exist'] });
		};

		const result = await adapter.fetchTask('NOPE-99');
		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.error.message, /404/);
	});

	it('postComment sends ADF body', async () => {
		let receivedBody: unknown;

		routeHandler = (req, res, body) => {
			assert.equal(req.method, 'POST');
			assert.match(req.url, /\/rest\/api\/3\/issue\/TEST-1\/comment$/);
			receivedBody = JSON.parse(body);
			jsonRes(res, 201, {
				id: '12345',
				body: {
					type: 'doc',
					version: 1,
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'my comment' }] }],
				},
				created: '2025-01-01T00:00:00.000+0000',
			});
		};

		const result = await adapter.postComment('TEST-1', 'my comment');
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.value.id, '12345');
		assert.equal(result.value.body, 'my comment');

		const parsed = receivedBody as { body: unknown };
		assert.equal(parsed.body.type, 'doc');
		assert.equal(parsed.body.version, 1);
	});

	it('listStatuses parses transitions', async () => {
		routeHandler = (req, res) => {
			assert.equal(req.method, 'GET');
			assert.match(req.url, /\/rest\/api\/3\/issue\/TEST-1\/transitions$/);
			jsonRes(res, 200, TRANSITIONS_RESPONSE);
		};

		const result = await adapter.listStatuses('TEST-1');
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.value.length, 2);
		assert.equal(result.value[0]!.id, '31');
		assert.equal(result.value[0]!.name, 'Done');
		assert.equal(result.value[0]!.toStatusName, 'Done');
		assert.equal(result.value[1]!.toStatusName, 'In Progress');
	});

	it('addTag sends PUT with label payload', async () => {
		let receivedBody: unknown;

		routeHandler = (req, res, body) => {
			assert.equal(req.method, 'PUT');
			assert.match(req.url, /\/rest\/api\/3\/issue\/TEST-1$/);
			receivedBody = JSON.parse(body);
			res.writeHead(204);
			res.end();
		};

		const result = await adapter.addTag('TEST-1', 'my-label');
		assert.equal(result.ok, true);

		const parsed = receivedBody as { update: { labels: Array<{ add: string }> } };
		assert.deepEqual(parsed.update.labels, [{ add: 'my-label' }]);
	});

	it('removeTag sends PUT with remove payload', async () => {
		let receivedBody: unknown;

		routeHandler = (req, res, body) => {
			assert.equal(req.method, 'PUT');
			assert.match(req.url, /\/rest\/api\/3\/issue\/TEST-1$/);
			receivedBody = JSON.parse(body);
			res.writeHead(204);
			res.end();
		};

		const result = await adapter.removeTag('TEST-1', 'old-label');
		assert.equal(result.ok, true);

		const parsed = receivedBody as { update: { labels: Array<{ remove: string }> } };
		assert.deepEqual(parsed.update.labels, [{ remove: 'old-label' }]);
	});

	it('timeout returns error when server is slow', async () => {
		routeHandler = (_req, _res) => {
			setTimeout(() => {
				_res.writeHead(200);
				_res.end('{}');
			}, 500);
		};

		const slowAdapter = new RealJiraAdapter(SITE, EMAIL, TOKEN, 100);
		const result = await slowAdapter.fetchTask('TEST-1');
		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.error.message, /timed out/i);
	});

	it('connection refused returns network error', async () => {
		const badAdapter = new RealJiraAdapter('http://localhost:19999', EMAIL, TOKEN, 1000);
		const result = await badAdapter.fetchTask('TEST-1');
		assert.equal(result.ok, false);
	});
});
