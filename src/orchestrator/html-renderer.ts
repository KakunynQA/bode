export function renderArtifactHtml(title: string, markdown: string): string {
	const escaped = escapeHtml(markdown);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Inter,Segoe UI,Arial,sans-serif;margin:0;background:#0f172a;color:#e5e7eb}main{max-width:980px;margin:0 auto;padding:40px 20px}pre{white-space:pre-wrap;background:#111827;border:1px solid #334155;border-radius:12px;padding:20px}h1{color:#93c5fd}.card{background:#172033;border:1px solid #334155;border-radius:16px;padding:24px;box-shadow:0 20px 50px #0004}
</style>
</head>
<body><main><h1>${escapeHtml(title)}</h1><section class="card"><pre>${escaped}</pre></section></main></body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}
