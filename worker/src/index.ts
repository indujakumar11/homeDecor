import { getOtpProvider, type OtpProvider } from './otpProvider';

export interface Env {
	DECOR_IMAGES: R2Bucket;
	// Step 3E.1/3E.2 — must be the literal string "development" for the mock
	// OTP provider to do anything at all (see worker/otpProvider.ts's
	// getOtpProvider/MockOtpProvider — both independently check this); any
	// other value (unset, "production", a typo — all fail closed identically)
	// makes the mock refuse to run. Configured only in worker/.dev.vars
	// (gitignored) for local dev; a real deployment must never set this to
	// "development".
	ENVIRONMENT: string;
	// Configured via worker/.dev.vars (gitignored, never committed — see the
	// "Required local config" comment further down for exactly what to put in
	// that file). SUPABASE_URL/SUPABASE_ANON_KEY are not secrets (the anon
	// key is already public, embedded in the React bundle) but live here too
	// so all local-env config is in one place.
	SUPABASE_URL: string;
	SUPABASE_ANON_KEY: string;
	OTP_PROOF_SECRET: string;
	// Step 3D — used ONLY server-side, to write/clear the
	// public.otp_authorizations table (see
	// supabase/migrations/003_otp_verified_rls.sql). Never sent to React,
	// never exposed to the browser in any response. This is exactly what
	// service-role keys are for: a trusted backend component acting with
	// elevated privilege — the opposite of putting one in VITE_* env vars.
	SUPABASE_SERVICE_ROLE_KEY: string;
	// Step 3E.2 — see worker/otpProvider.ts for the full selection contract.
	// Must be explicitly "mock" or "twilio"; there is no default and no
	// inference from which credentials happen to be present. Local dev sets
	// this to "mock" in worker/.dev.vars.
	OTP_PROVIDER?: string;
	// Twilio Verify V2 credentials — never set locally (no real Twilio
	// account is used during development). Optional here because the mock
	// provider path never reads them; getOtpProvider() requires all three
	// to be present before it will construct a TwilioVerifyProvider, and
	// fails closed (throws) rather than falling back to the mock if
	// OTP_PROVIDER="twilio" but any of these is missing.
	TWILIO_ACCOUNT_SID?: string;
	TWILIO_AUTH_TOKEN?: string;
	TWILIO_VERIFY_SERVICE_SID?: string;
}

// Step 2C/2D (local dev only): the Admin Portal calls these routes for
// real, from a different origin (the Vite dev server) — so every response
// needs CORS headers.
//
//   POST   /api/upload          - upload an image, returns { key, retrieveUrl }
//                                  (Step 3C.1: now requires a Supabase session
//                                  + a valid OTP proof — see requireOtpVerifiedUser)
//   GET    /api/images/:key     - retrieve a stored image (public, unauthenticated
//                                  — the public site displays these images)
//   DELETE /api/images/:key     - remove a stored image (Step 3C.1: same auth
//                                  requirement as upload). Used for: (a) orphan
//                                  cleanup when a Supabase write fails after a
//                                  successful upload, (b) removing the old
//                                  image after a successful Edit Decor image
//                                  replacement, (c) removing a decor item's
//                                  image on Delete Decor. See
//                                  src/services/uploadService.js for the
//                                  ordering/failure-handling rules around each.
//   POST   /api/otp/start       - Identifies the caller, confirms they're an
//                                  enabled admin (admin_users), looks up
//                                  their phone SERVER-SIDE, and asks the
//                                  configured OtpProvider (worker/otpProvider.ts
//                                  — the mock locally, Twilio Verify in a real
//                                  deployment) to start a verification. No
//                                  code is ever returned in the response.
//   POST   /api/otp/verify      - Same identity/admin checks, then asks the
//                                  provider to check the submitted code. On
//                                  success, records server-side OTP
//                                  authorization (see recordOtpAuthorization)
//                                  and returns a short-lived signed "OTP
//                                  proof" the client must present on
//                                  privileged requests.
//   POST   /api/otp/revoke      - Clears this user's server-side OTP
//                                  authorization (called on logout) so a
//                                  later login does not silently inherit it
//                                  — see authService.js logout(). Provider-
//                                  agnostic (only touches otp_authorizations),
//                                  and only requires a valid Supabase
//                                  session, not an OTP proof — revoking
//                                  authorization should never be harder than
//                                  granting it.
//
// These are the ONLY OTP routes this Worker exposes — the earlier separate
// development-only route family has been removed; OTP_PROVIDER=mock
// (worker/otpProvider.ts) now covers local development through these same
// routes.

const ALLOWED_TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — development-only limit
const UPLOAD_PREFIX = 'uploads/';

// Matches exactly what handleUpload generates: uploads/<uuid>.<ext>. Applied
// to every key-bearing request (GET/DELETE) so malformed, path-traversal-
// looking, or otherwise unexpected keys are rejected with a clean 400
// instead of being passed through to R2. R2 keys are opaque strings (not
// filesystem paths), so there's no traversal vulnerability in R2 itself —
// this is defense in depth, and it also guarantees one decor item's key can
// never collide with or accidentally reference another's.
const VALID_KEY_PATTERN = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

function isValidKey(key: string): boolean {
	return VALID_KEY_PATTERN.test(key);
}

// ----------------------------------------------------------------------------
// CORS (Step 3C.2, objective 16)
// ----------------------------------------------------------------------------
// Previously a blanket wildcard. This app doesn't use cookies (every
// credential — the Supabase bearer token, the OTP proof — is attached
// explicitly by our own JS, never auto-sent by the browser the way a cookie
// would be), so a wildcard origin was not exploitable the way it would be
// for cookie-authenticated APIs. Even so, there's no reason for arbitrary
// origins to be able to read responses from R2-touching routes, so this is
// tightened to an explicit allowlist of the exact local dev origins the
// Vite dev server actually runs on. Add a new entry here (not a wildcard)
// if you serve the Admin Portal from a different local port/host.
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function corsHeadersFor(request: Request): Record<string, string> {
	const requestOrigin = request.headers.get('origin') || '';
	const allowOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
	return {
		'access-control-allow-origin': allowOrigin,
		'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
		'access-control-allow-headers': 'authorization, content-type, x-otp-proof',
		// Tells caches/CDNs the response varies by Origin — correct practice
		// whenever the allow-origin value is echoed conditionally like this.
		vary: 'origin',
	};
}

// ============================================================================
// OTP proof signing — shared by every OTP provider (mock or Twilio)
// ============================================================================
// This block is provider-agnostic: it exists regardless of whether
// OTP_PROVIDER is "mock" or "twilio" (see worker/otpProvider.ts for what
// varies between them). It only concerns itself with "how do we prove, in a
// way the browser cannot forge, that this Supabase user completed OTP
// verification recently" — handleOtpVerify below calls signOtpProof() after
// the provider confirms the code was correct, whichever provider that is.
//
// Required local config (worker/.dev.vars — gitignored, never commit):
//   ENVIRONMENT=development
//   SUPABASE_URL=http://127.0.0.1:54321
//   SUPABASE_ANON_KEY=<the local anon key from `supabase status`>
//   OTP_PROOF_SECRET=<any long random string, e.g. `openssl rand -hex 32`>
//   OTP_PROVIDER=mock

// Step 3D.1: reduced from 1 hour to 15 minutes. This is BOTH the Worker's
// signed OTP proof lifetime (R2) and — since recordOtpAuthorization below
// uses this same value — the public.otp_authorizations DB row's lifetime
// (the RLS/JWT claim), kept in sync deliberately so R2 and database
// authorization always expire together. Supabase's own access-token
// lifetime ([auth] jwt_expiry in supabase/config.toml) was ALSO reduced to
// match (900s) — see the Step 3D.1 report's JWT lifetime section for the
// full reasoning and the resulting worst-case authorization window, which
// this change alone does not fully close (an already-minted token remains
// valid for its own jwt_expiry regardless of this constant — see
// verifyOtpProof/the custom_access_token_hook's documented limitation).
// IMPORTANT: this proof represents only that the browser completed THIS
// PROJECT'S CUSTOM OTP GATE — it is an application-level second factor
// this codebase invented and verifies itself. It is NOT a Supabase-native
// AAL2/MFA session, does not touch Supabase's own `aal` claim, and
// Supabase has no awareness of it. Real AAL2 (Supabase Advanced MFA Phone)
// remains a separate, later, explicitly out-of-scope step.
const OTP_PROOF_TTL_MS = 15 * 60 * 1000;
// Bumped if the proof's shape/semantics ever change, so an old-format token
// (or a token from some other signed-token scheme this Worker might grow
// later) is never mistaken for a current OTP proof.
const OTP_PROOF_TYPE = 'dev-otp-proof-v1';

function base64url(bytes: ArrayBuffer | Uint8Array): string {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = '';
	for (const byte of arr) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(value: string): Uint8Array {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function importOtpProofKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify',
	]);
}

// The proof is a minimal, self-contained signed token (not a database row):
// base64url(payload) + "." + base64url(HMAC-SHA256 signature). Payload only
// carries a type/version tag, the Supabase user id, and an expiry — nothing
// else is needed, so nothing else is included (in particular: no phone
// number, no email, no role/admin flag). Impossible to forge without
// OTP_PROOF_SECRET, which only this Worker holds.
async function signOtpProof(userId: string, secret: string): Promise<{ token: string; expiresAt: number }> {
	const expiresAt = Date.now() + OTP_PROOF_TTL_MS;
	const payloadBytes = new TextEncoder().encode(JSON.stringify({ typ: OTP_PROOF_TYPE, sub: userId, exp: expiresAt }));
	const payloadB64 = base64url(payloadBytes);
	const key = await importOtpProofKey(secret);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
	return { token: `${payloadB64}.${base64url(signature)}`, expiresAt };
}

// Rejects: malformed tokens, wrong/missing type tag, expired tokens, tokens
// for a different user, and (via crypto.subtle.verify, which is a
// constant-time comparison) tokens signed with the wrong secret or tampered
// with in any way.
async function verifyOtpProof(token: string | null, expectedUserId: string, secret: string): Promise<boolean> {
	if (!token || !token.includes('.')) return false;
	const [payloadB64, sigB64] = token.split('.');
	if (!payloadB64 || !sigB64) return false;

	let payload: { typ?: unknown; sub?: unknown; exp?: unknown };
	try {
		payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
	} catch {
		return false;
	}
	if (payload.typ !== OTP_PROOF_TYPE) return false;
	if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return false;
	if (payload.sub !== expectedUserId) return false;
	if (Date.now() >= payload.exp) return false;

	try {
		const key = await importOtpProofKey(secret);
		return await crypto.subtle.verify('HMAC', key, base64urlToBytes(sigB64), new TextEncoder().encode(payloadB64));
	} catch {
		return false;
	}
}

interface SupabaseUser {
	id: string;
	email?: string;
}

// ============================================================================
// Step 3D — server-side OTP authorization (drives the otp_verified JWT claim)
// ============================================================================
// Writes/clears public.otp_authorizations using the service-role key, which
// bypasses RLS by design — this is the one and only place in this codebase
// that key is used, and it never leaves the Worker (see Env.
// SUPABASE_SERVICE_ROLE_KEY above and worker/.dev.vars). The database's
// custom_access_token_hook (supabase/migrations/003_otp_verified_rls.sql)
// reads this table whenever GoTrue mints or refreshes an access token and
// stamps app_metadata.otp_verified accordingly — that JWT claim, not
// anything this Worker returns directly, is what RLS actually checks.
const OTP_AUTHORIZATIONS_ENDPOINT = (env: Env) => `${env.SUPABASE_URL}/rest/v1/otp_authorizations`;

function serviceRoleHeaders(env: Env, extra: Record<string, string> = {}): Record<string, string> {
	return {
		apikey: env.SUPABASE_SERVICE_ROLE_KEY,
		authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
		'content-type': 'application/json',
		...extra,
	};
}

// Upserts (via PostgREST's on-conflict merge) this user's OTP authorization
// row. Returns false on any failure — callers must treat that as "OTP
// authorization could not be established" and fail closed, since telling
// the client "verified" while this write silently failed would leave R2
// (Worker-proof-gated) working but the database (claim-gated) still locked,
// an inconsistent and confusing state.
async function recordOtpAuthorization(userId: string, expiresAtMs: number, env: Env): Promise<boolean> {
	try {
		const res = await fetch(OTP_AUTHORIZATIONS_ENDPOINT(env), {
			method: 'POST',
			headers: serviceRoleHeaders(env, { prefer: 'resolution=merge-duplicates,return=minimal' }),
			body: JSON.stringify({ user_id: userId, expires_at: new Date(expiresAtMs).toISOString() }),
		});
		return res.ok;
	} catch {
		return false;
	}
}

// Best-effort delete of this user's OTP authorization row — called on
// logout, and defensively at the start of a new OTP challenge, so a stale
// still-unexpired row from a prior session is never silently inherited
// going forward. Never throws: this is hygiene, not the primary security
// boundary (that's the row's own expires_at, checked inside the hook).
async function clearOtpAuthorization(userId: string, env: Env): Promise<boolean> {
	try {
		const res = await fetch(`${OTP_AUTHORIZATIONS_ENDPOINT(env)}?user_id=eq.${userId}`, {
			method: 'DELETE',
			headers: serviceRoleHeaders(env, { prefer: 'return=minimal' }),
		});
		return res.ok;
	} catch {
		return false;
	}
}

// ============================================================================
// Step 3D.1 — admin allowlist check (public.admin_users)
// ============================================================================
// "Authenticated Supabase user" and "admin" are no longer the same thing.
// Before this Worker will start an OTP challenge, verify one, or treat an
// OTP proof as sufficient for R2, it independently confirms — via the
// service-role key, live, on every call — that the caller is present in
// admin_users with enabled=true. This is the SAME table the database's own
// custom_access_token_hook checks (defense in depth: two independent
// enforcement points, not one relying on the other). A non-admin account
// can complete every step of the OTP UI flow and still never obtain a
// usable proof or an otp_verified JWT claim.
async function isEnabledAdmin(userId: string, env: Env): Promise<boolean> {
	try {
		const res = await fetch(`${env.SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${userId}&select=enabled`, {
			headers: serviceRoleHeaders(env),
		});
		if (!res.ok) return false;
		const rows = (await res.json()) as Array<{ enabled: boolean }>;
		return rows.length > 0 && rows[0].enabled === true;
	} catch {
		return false;
	}
}

// Identifies the caller by asking Supabase's own Auth server to validate
// the bearer token — the Worker never decodes/trusts a user id supplied by
// the browser itself (a request body or header claiming "I am user X" is
// never sufficient on its own).
async function getAuthenticatedUser(request: Request, env: Env): Promise<SupabaseUser | null> {
	const authHeader = request.headers.get('authorization') || '';
	const token = authHeader.replace(/^Bearer\s+/i, '').trim();
	if (!token) return null;

	try {
		const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
			headers: {
				apikey: env.SUPABASE_ANON_KEY,
				authorization: `Bearer ${token}`,
			},
		});
		if (!res.ok) return null;
		const user = (await res.json()) as SupabaseUser;
		return user?.id ? user : null;
	} catch {
		return null;
	}
}

// Gate for privileged R2 routes: requires BOTH a valid Supabase session AND
// a valid, matching OTP proof — neither credential is sufficient alone (see
// requireOtpVerifiedUser callers: handleUpload/handleDeleteImage each call
// this before doing anything else). Returns the authenticated user on
// success, or a ready-to-return 401 Response (with CORS headers already
// applied) on any failure — callers just do
// `if (result instanceof Response) return result;`.
async function requireOtpVerifiedUser(request: Request, env: Env): Promise<SupabaseUser | Response> {
	const user = await getAuthenticatedUser(request, env);
	if (!user) {
		return json({ error: 'Your session has expired. Please log in again.' }, 401, request);
	}

	const proofToken = request.headers.get('x-otp-proof');
	const proofValid = await verifyOtpProof(proofToken, user.id, env.OTP_PROOF_SECRET);
	if (!proofValid) {
		return json({ error: 'Verification required. Please complete the OTP step.' }, 401, request);
	}

	// Step 3D.1: a proof can only ever have been minted for an admin at the
	// time it was issued (handleOtpVerify checks this before minting), but
	// admin status can change afterward — re-checking live here means a
	// disabled admin loses R2 access on their VERY NEXT request, not only
	// once their proof eventually expires. This is stricter than the
	// database/RLS path, which cannot re-check mid-token (see the Step 3D.1
	// report's JWT lifetime section) — R2 does not have that limitation
	// because every request already reaches this Worker live.
	const admin = await isEnabledAdmin(user.id, env);
	if (!admin) {
		return json({ error: 'Your account is not authorized for admin access.' }, 403, request);
	}

	return user;
}

// ============================================================================
// OTP routes (/api/otp/*) — the application's only OTP API
// ============================================================================
// Which actual provider runs behind these is decided entirely by
// getOtpProvider(env) (worker/otpProvider.ts) — these handlers never
// reference Twilio or the mock by name, and never change based on
// ENVIRONMENT themselves (the provider layer is what fails closed if
// misconfigured). Everything security-relevant — identifying the caller,
// confirming enabled-admin status, recording otp_authorizations, signing
// the OTP proof — lives here, reused unchanged regardless of provider;
// only "was the code correct" is delegated to the provider.

// Looks up the authenticated user's own phone number from admin_users —
// server-side only, via the service-role key. The client never supplies a
// phone number in the request body for either /api/otp route; accepting
// one from the browser would let it choose an arbitrary SMS destination
// (someone else's phone, or the attacker's own), defeating the entire
// point of binding verification to a specific pre-registered admin.
async function getAdminPhone(userId: string, env: Env): Promise<string | null> {
	try {
		const res = await fetch(`${env.SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${userId}&select=phone`, {
			headers: serviceRoleHeaders(env),
		});
		if (!res.ok) return null;
		const rows = (await res.json()) as Array<{ phone: string }>;
		return rows.length > 0 && rows[0].phone ? rows[0].phone : null;
	} catch {
		return null;
	}
}

// Step 3F — the NANP reserved fictional-use number
// (supabase/migrations/005_admin_phone.sql) backfilled onto admin_users.phone
// for local development. It is never dialable and the mock provider never
// actually sends anything to it, so it's harmless in development. In
// production it must never be treated as a real destination: if a real phone
// number was never set on an admin_users row before a production deploy,
// that is a configuration error to fail closed on, not something to send an
// SMS (or a Twilio API call) to anyway.
const DEV_PLACEHOLDER_PHONE = '+15555550100';

function isProductionUnsafePhone(phone: string, env: Env): boolean {
	return env.ENVIRONMENT === 'production' && phone === DEV_PLACEHOLDER_PHONE;
}

async function handleOtpStart(request: Request, env: Env): Promise<Response> {
	const user = await getAuthenticatedUser(request, env);
	if (!user) {
		return json(
			{ success: false, error: 'session_expired', message: 'Your session has expired. Please log in again.' },
			401,
			request
		);
	}

	const admin = await isEnabledAdmin(user.id, env);
	if (!admin) {
		return json(
			{ success: false, error: 'not_authorized', message: 'Your account is not authorized for admin access.' },
			403,
			request
		);
	}

	const phone = await getAdminPhone(user.id, env);
	if (!phone) {
		// Should not happen once every admin_users row has a phone (see
		// migration 005), but fail closed rather than proceed with no
		// destination if it ever does.
		console.error(`[handleOtpStart] admin ${user.id} has no phone number on file.`);
		return json(
			{ success: false, error: 'not_configured', message: 'Unable to send verification code. Please try again.' },
			503,
			request
		);
	}

	if (isProductionUnsafePhone(phone, env)) {
		console.error(
			`[handleOtpStart] admin ${user.id} still has the development placeholder phone number on file in production — refusing to start verification.`
		);
		return json(
			{ success: false, error: 'not_configured', message: 'Unable to send verification code. Please try again.' },
			503,
			request
		);
	}

	let provider: OtpProvider;
	try {
		provider = getOtpProvider(env);
	} catch (err) {
		// getOtpProvider's own error message names the misconfiguration (e.g.
		// "OTP_PROVIDER=twilio requires ...") for the Worker operator to see
		// here — never forwarded to the client.
		console.error('[handleOtpStart] OTP provider unavailable:', err instanceof Error ? err.message : String(err));
		return json(
			{ success: false, error: 'provider_unavailable', message: 'Verification service unavailable. Please try again.' },
			503,
			request
		);
	}

	const result = await provider.startVerification(phone);
	if (!result.success) {
		return json(
			{ success: false, error: 'provider_error', message: 'Unable to send verification code. Please try again.' },
			502,
			request
		);
	}

	// Never include the phone number, provider name, or any provider detail
	// in the response — the browser only ever needs to know "proceed to the
	// OTP entry screen."
	return json({ success: true }, 200, request);
}

async function handleOtpVerify(request: Request, env: Env): Promise<Response> {
	const user = await getAuthenticatedUser(request, env);
	if (!user) {
		return json(
			{ success: false, error: 'session_expired', message: 'Your session has expired. Please log in again.' },
			401,
			request
		);
	}

	const admin = await isEnabledAdmin(user.id, env);
	if (!admin) {
		return json(
			{ success: false, error: 'not_authorized', message: 'Your account is not authorized for admin access.' },
			403,
			request
		);
	}

	const phone = await getAdminPhone(user.id, env);
	if (!phone) {
		console.error(`[handleOtpVerify] admin ${user.id} has no phone number on file.`);
		return json(
			{ success: false, error: 'not_configured', message: 'Unable to verify code. Please try again.' },
			503,
			request
		);
	}

	if (isProductionUnsafePhone(phone, env)) {
		console.error(
			`[handleOtpVerify] admin ${user.id} still has the development placeholder phone number on file in production — refusing to verify.`
		);
		return json(
			{ success: false, error: 'not_configured', message: 'Unable to verify code. Please try again.' },
			503,
			request
		);
	}

	let body: { otp?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'invalid_request', message: 'Invalid request.' }, 400, request);
	}
	const submittedOtp = typeof body.otp === 'string' ? body.otp.trim() : '';
	if (!submittedOtp) {
		return json({ success: false, error: 'invalid_otp', message: 'Invalid OTP.' }, 400, request);
	}

	let provider: OtpProvider;
	try {
		provider = getOtpProvider(env);
	} catch (err) {
		console.error('[handleOtpVerify] OTP provider unavailable:', err instanceof Error ? err.message : String(err));
		return json(
			{ success: false, error: 'provider_unavailable', message: 'Verification service unavailable. Please try again.' },
			503,
			request
		);
	}

	const result = await provider.checkVerification(phone, submittedOtp);
	if (!result.success) {
		// Fail closed: on ANY provider failure — wrong code, expired, too
		// many attempts, or a provider/network error — nothing further
		// happens. No otp_authorizations write, no proof, no
		// otp_verified=true. One generic message regardless of the
		// underlying reason (the provider's specific `error` is logged
		// server-side only, not surfaced) — this is deliberately less
		// granular than the DEV OTP routes' error codes, since real Twilio
		// Verify cannot reliably distinguish "wrong code" from "expired"
		// either, and a uniform response leaks less to a client attempting
		// to enumerate OTP state.
		return json({ success: false, error: 'invalid_otp', message: 'Invalid or expired OTP. Please try again.' }, 400, request);
	}

	const { token, expiresAt } = await signOtpProof(user.id, env.OTP_PROOF_SECRET);

	const dbAuthorized = await recordOtpAuthorization(user.id, expiresAt, env);
	if (!dbAuthorized) {
		return json(
			{
				success: false,
				error: 'authorization_unavailable',
				message: 'Verification service unavailable. Please try again.',
			},
			503,
			request
		);
	}

	return json({ success: true, otpProof: token, expiresAt }, 200, request);
}

// Revocation is provider-agnostic (it only clears our own
// otp_authorizations record) so it needs no provider selection at all.
// Called by authService.js's logout(). Only requires a valid Supabase
// session, not an OTP proof — revoking authorization should never be
// harder than granting it.
async function handleOtpRevoke(request: Request, env: Env): Promise<Response> {
	const user = await getAuthenticatedUser(request, env);
	if (!user) {
		return json(
			{ success: false, error: 'session_expired', message: 'Your session has expired. Please log in again.' },
			401,
			request
		);
	}

	await clearOtpAuthorization(user.id, env);

	return json({ success: true }, 200, request);
}

function withCors(response: Response, request: Request): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeadersFor(request))) {
		headers.set(key, value);
	}
	return new Response(response.body, { status: response.status, headers });
}

function json(data: unknown, status: number, request: Request): Response {
	return withCors(Response.json(data, { status }), request);
}

async function handleHealth(request: Request, env: Env): Promise<Response> {
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

	return json(
		{
			worker: 'ok',
			r2Binding: r2Status,
			r2Error,
			bucketBinding: 'DECOR_IMAGES',
		},
		200,
		request
	);
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
	const authResult = await requireOtpVerifiedUser(request, env);
	if (authResult instanceof Response) return authResult;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ error: 'Expected multipart/form-data with a "file" field.' }, 400, request);
	}

	const file = formData.get('file');
	if (!(file instanceof File)) {
		return json({ error: 'No file provided. Send it as multipart/form-data field "file".' }, 400, request);
	}

	const extension = ALLOWED_TYPES[file.type];
	if (!extension) {
		return json(
			{ error: `Unsupported image type "${file.type}". Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}` },
			400,
			request
		);
	}

	if (file.size === 0) {
		return json({ error: 'Uploaded file is empty.' }, 400, request);
	}

	if (file.size > MAX_FILE_SIZE) {
		return json(
			{ error: `File is ${file.size} bytes, which exceeds the ${MAX_FILE_SIZE} byte (5MB) development limit.` },
			400,
			request
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
		return json({ error: `Failed to store image in R2: ${message}` }, 500, request);
	}

	return json(
		{
			success: true,
			key,
			size: file.size,
			contentType: file.type,
			retrieveUrl: `/api/images/${key}`,
		},
		200,
		request
	);
}

function extractKey(request: Request, prefix: string): string {
	const url = new URL(request.url);
	return decodeURIComponent(url.pathname.slice(prefix.length));
}

async function handleGetImage(request: Request, env: Env): Promise<Response> {
	const key = extractKey(request, '/api/images/');
	if (!key) {
		return json({ error: 'No object key provided.' }, 400, request);
	}
	if (!isValidKey(key)) {
		return json({ error: 'Invalid object key.' }, 400, request);
	}

	let object: R2ObjectBody | null;
	try {
		object = await env.DECOR_IMAGES.get(key);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json({ error: `Failed to read from R2: ${message}` }, 500, request);
	}

	if (!object) {
		return json({ error: `No object found for key "${key}".` }, 404, request);
	}

	return withCors(
		new Response(object.body, {
			headers: {
				'content-type': object.httpMetadata?.contentType || 'application/octet-stream',
				'content-length': String(object.size),
				etag: object.httpEtag,
			},
		}),
		request
	);
}

// Step 3C.2, objective 15 (R2 object authorization): any authenticated +
// OTP-verified admin can delete any valid-shaped R2 key, not just one they
// personally uploaded. This is intentional, not an oversight — this app has
// no per-admin ownership model (RLS already treats `authenticated` as
// synonymous with "admin", see 002_authenticated_write_access.sql), and the
// Admin Portal's own UI lets any admin edit/delete any gallery item. A
// finer-grained per-admin permission model is a real redesign (roles, an
// admin table) explicitly out of scope for this step.
async function handleDeleteImage(request: Request, env: Env): Promise<Response> {
	const authResult = await requireOtpVerifiedUser(request, env);
	if (authResult instanceof Response) return authResult;

	const key = extractKey(request, '/api/images/');
	if (!key) {
		return json({ error: 'No object key provided.' }, 400, request);
	}
	if (!isValidKey(key)) {
		return json({ error: 'Invalid object key.' }, 400, request);
	}

	try {
		// R2 delete() does not error on a missing key — it's idempotent, which
		// is what we want for a "best effort" cleanup call.
		await env.DECOR_IMAGES.delete(key);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json({ error: `Failed to delete from R2: ${message}` }, 500, request);
	}

	return json({ success: true, key }, 200, request);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeadersFor(request) });
		}

		if (url.pathname === '/health') {
			return handleHealth(request, env);
		}

		if (request.method === 'POST' && url.pathname === '/api/upload') {
			return handleUpload(request, env);
		}

		// No ENVIRONMENT gate at the dispatcher level for these: they're meant
		// to work in every environment, with getOtpProvider(env) (worker/
		// otpProvider.ts) — not this dispatcher — deciding mock vs. Twilio,
		// and failing closed on its own if misconfigured.
		if (request.method === 'POST' && url.pathname === '/api/otp/start') {
			return handleOtpStart(request, env);
		}

		if (request.method === 'POST' && url.pathname === '/api/otp/verify') {
			return handleOtpVerify(request, env);
		}

		if (request.method === 'POST' && url.pathname === '/api/otp/revoke') {
			return handleOtpRevoke(request, env);
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
			}),
			request
		);
	},
} satisfies ExportedHandler<Env>;
