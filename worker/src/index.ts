export interface Env {
	DECOR_IMAGES: R2Bucket;
}

// Step 2C (local dev only): the Admin Portal now calls these routes for
// real, from a different origin (the Vite dev server) — so unlike the
// Step 2B test-only routes, every response needs CORS headers, and the
// "test-" prefix is dropped now that this is the actual upload path.
//
//   POST   /api/upload        - upload an image, returns { key, retrieveUrl }
//   GET    /api/images/:key   - retrieve a stored image
//   DELETE /api/images/:key   - remove a stored image (used for orphan
//                               cleanup when a Supabase write fails after a
//                               successful upload — not wired to the
//                               Admin Portal's "Delete Decor" button yet)

const ALLOWED_TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — development-only limit
const UPLOAD_PREFIX = 'uploads/';

const CORS_HEADERS: Record<string, string> = {
	// Local dev only, no cookies/credentials involved — a wildcard origin is
	// fine here and keeps this simple. Revisit before anything resembling
	// production.
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
	'access-control-allow-headers': '*',
};

function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		headers.set(key, value);
	}
	return new Response(response.body, { status: response.status, headers });
}

function json(data: unknown, status = 200): Response {
	return withCors(Response.json(data, { status }));
}

async function handleHealth(env: Env): Promise<Response> {
	// list() is a read-only, harmless call — proves the R2 binding is
	// live and talking to the local (Miniflare-simulated) bucket
	// without writing or uploading anything.
	let r2Status: 'ok' | 'error' = 'ok';
	let r2Error: string | null = null;
	try {
		await env.DECOR_IMAGES.list();
	} catch (err) {
		r2Status = 'error';
		r2Error = err instanceof Error ? err.message : String(err);
	}

	return json({
		worker: 'ok',
		r2Binding: r2Status,
		r2Error,
		bucketBinding: 'DECOR_IMAGES',
	});
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ error: 'Expected multipart/form-data with a "file" field.' }, 400);
	}

	const file = formData.get('file');
	if (!(file instanceof File)) {
		return json({ error: 'No file provided. Send it as multipart/form-data field "file".' }, 400);
	}

	const extension = ALLOWED_TYPES[file.type];
	if (!extension) {
		return json(
			{ error: `Unsupported image type "${file.type}". Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}` },
			400
		);
	}

	if (file.size === 0) {
		return json({ error: 'Uploaded file is empty.' }, 400);
	}

	if (file.size > MAX_FILE_SIZE) {
		return json(
			{ error: `File is ${file.size} bytes, which exceeds the ${MAX_FILE_SIZE} byte (5MB) development limit.` },
			400
		);
	}

	// Key is generated server-side (never taken from user input), so it's
	// inherently safe to use directly as an R2 object key.
	const key = `${UPLOAD_PREFIX}${crypto.randomUUID()}.${extension}`;

	try {
		await env.DECOR_IMAGES.put(key, await file.arrayBuffer(), {
			httpMetadata: { contentType: file.type },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json({ error: `Failed to store image in R2: ${message}` }, 500);
	}

	return json({
		success: true,
		key,
		size: file.size,
		contentType: file.type,
		retrieveUrl: `/api/images/${key}`,
	});
}

function extractKey(request: Request, prefix: string): string {
	const url = new URL(request.url);
	return decodeURIComponent(url.pathname.slice(prefix.length));
}

async function handleGetImage(request: Request, env: Env): Promise<Response> {
	const key = extractKey(request, '/api/images/');
	if (!key) {
		return json({ error: 'No object key provided.' }, 400);
	}

	let object: R2ObjectBody | null;
	try {
		object = await env.DECOR_IMAGES.get(key);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json({ error: `Failed to read from R2: ${message}` }, 500);
	}

	if (!object) {
		return json({ error: `No object found for key "${key}".` }, 404);
	}

	return withCors(
		new Response(object.body, {
			headers: {
				'content-type': object.httpMetadata?.contentType || 'application/octet-stream',
				'content-length': String(object.size),
				etag: object.httpEtag,
			},
		})
	);
}

async function handleDeleteImage(request: Request, env: Env): Promise<Response> {
	const key = extractKey(request, '/api/images/');
	if (!key) {
		return json({ error: 'No object key provided.' }, 400);
	}

	try {
		// R2 delete() does not error on a missing key — it's idempotent, which
		// is what we want for a "best effort" cleanup call.
		await env.DECOR_IMAGES.delete(key);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json({ error: `Failed to delete from R2: ${message}` }, 500);
	}

	return json({ success: true, key });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		if (url.pathname === '/health') {
			return handleHealth(env);
		}

		if (request.method === 'POST' && url.pathname === '/api/upload') {
			return handleUpload(request, env);
		}

		if (request.method === 'GET' && url.pathname.startsWith('/api/images/')) {
			return handleGetImage(request, env);
		}

		if (request.method === 'DELETE' && url.pathname.startsWith('/api/images/')) {
			return handleDeleteImage(request, env);
		}

		return withCors(
			new Response('Home Decor Worker is running (local dev only).', {
				headers: { 'content-type': 'text/plain' },
			})
		);
	},
} satisfies ExportedHandler<Env>;
