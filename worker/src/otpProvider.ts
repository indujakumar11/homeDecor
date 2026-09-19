// ============================================================================
// Step 3E.2 — OTP provider abstraction
// ============================================================================
// The route handlers in index.ts (handleOtpStart/handleOtpVerify) depend
// only on this OtpProvider interface, never on Twilio or the mock directly.
// Their job is narrowly "was this phone verification successfully
// started/checked?" — everything else (identifying the caller, confirming
// they're an enabled admin, looking up their phone, recording
// otp_authorizations, signing the OTP proof) stays in index.ts and is
// reused unchanged from the existing DEV OTP implementation. Swapping the
// mock provider for the real Twilio one later is a configuration change
// (OTP_PROVIDER + Worker secrets), not a rewrite of that surrounding logic.
import { generateOtp, sha256Hex } from './cryptoUtils';

export interface OtpResult {
	success: boolean;
	// Internal diagnostic only — logged/branched on server-side, never sent
	// verbatim to the browser (see index.ts's handleOtpStart/handleOtpVerify,
	// which always map failures to one generic client-facing message).
	error?: string;
}

export interface OtpProvider {
	startVerification(phone: string): Promise<OtpResult>;
	checkVerification(phone: string, code: string): Promise<OtpResult>;
}

// ============================================================================
// Development Mock Provider — REMOVE/REPLACE WITH TWILIO VERIFY IN PRODUCTION
// ============================================================================
// Same CSPRNG generation, same hashing, same expiry/attempt/one-time-use/
// resend-invalidation rules the original (now-removed, Step 3E.3) DEV OTP
// route implementation used — this is that same design, just relocated
// behind the OtpProvider interface and keyed by phone number (matching what
// the real Twilio Verify API keys on) rather than by Supabase user id.
const MOCK_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MOCK_OTP_MAX_ATTEMPTS = 5;

interface MockChallenge {
	hash: string;
	expiresAt: number;
	attempts: number;
}

const mockChallenges = new Map<string, MockChallenge>(); // keyed by phone number

export class MockOtpProvider implements OtpProvider {
	constructor(private readonly environment: string) {}

	async startVerification(phone: string): Promise<OtpResult> {
		// Fail closed even if somehow constructed/invoked incorrectly — this
		// provider must never do anything at all outside development,
		// regardless of what OTP_PROVIDER claims elsewhere.
		if (this.environment !== 'development') {
			return { success: false, error: 'mock_provider_unavailable' };
		}

		const otp = generateOtp();
		const hash = await sha256Hex(otp);
		// A new verification always replaces/invalidates any previous one for
		// this phone — never more than one valid code at a time.
		mockChallenges.set(phone, { hash, expiresAt: Date.now() + MOCK_OTP_TTL_MS, attempts: 0 });

		// DEV ONLY — REMOVE/REPLACE WITH TWILIO VERIFY. Never returned in any
		// HTTP response, never persisted anywhere, only ever written to this
		// Worker's own terminal so local testing works without a phone or a
		// Twilio account. Only the code itself is logged — never the phone's
		// full value alongside any other identifying/secret material.
		console.log(`[DEV ONLY OTP] Verification code generated for development testing: ${otp} (expires in ${MOCK_OTP_TTL_MS / 1000}s)`);

		return { success: true };
	}

	async checkVerification(phone: string, code: string): Promise<OtpResult> {
		if (this.environment !== 'development') {
			return { success: false, error: 'mock_provider_unavailable' };
		}

		const challenge = mockChallenges.get(phone);
		if (!challenge) {
			return { success: false, error: 'no_pending_verification' };
		}

		if (Date.now() >= challenge.expiresAt) {
			mockChallenges.delete(phone);
			return { success: false, error: 'expired' };
		}

		if (challenge.attempts >= MOCK_OTP_MAX_ATTEMPTS) {
			mockChallenges.delete(phone);
			return { success: false, error: 'too_many_attempts' };
		}

		// Comparing SHA-256 hex digests, not the code itself: a timing
		// difference here does not leak anything about the plaintext code
		// (SHA-256's avalanche effect means a "closer" guess has no more hash
		// prefix in common than a wildly wrong one).
		const submittedHash = await sha256Hex(code);
		if (submittedHash !== challenge.hash) {
			challenge.attempts += 1;
			if (challenge.attempts >= MOCK_OTP_MAX_ATTEMPTS) {
				mockChallenges.delete(phone);
				return { success: false, error: 'too_many_attempts' };
			}
			return { success: false, error: 'invalid_code' };
		}

		// One-time use: invalidate immediately on success so the same code can
		// never be replayed.
		mockChallenges.delete(phone);
		return { success: true };
	}
}

// ============================================================================
// Twilio Verify V2 Provider
// ============================================================================
// Implemented now so the whole application is fully wired for Twilio, but
// never invoked during local development (see getOtpProvider below — the
// mock is what's actually selected while OTP_PROVIDER=mock). Uses Twilio
// Verify V2 (not V1) via plain fetch + HTTP Basic auth — no Twilio SDK:
// the SDK is a large Node-oriented dependency, and Verify's REST API is
// simple enough that raw fetch is sufficient, matching this project's
// existing convention of talking to external services (R2, Supabase) via
// direct fetch calls rather than SDKs.
export interface TwilioConfig {
	accountSid: string;
	authToken: string;
	verifyServiceSid: string;
}

export class TwilioVerifyProvider implements OtpProvider {
	constructor(private readonly config: TwilioConfig) {}

	private authHeader(): string {
		return `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`;
	}

	async startVerification(phone: string): Promise<OtpResult> {
		try {
			const res = await fetch(`https://verify.twilio.com/v2/Services/${this.config.verifyServiceSid}/Verifications`, {
				method: 'POST',
				headers: {
					authorization: this.authHeader(),
					'content-type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({ To: phone, Channel: 'sms' }),
			});
			if (!res.ok) {
				// Never forward Twilio's response body upward — it can include
				// account/service identifiers or other diagnostic detail that
				// shouldn't reach the browser. Log only the HTTP status
				// server-side; no request/response body, no credentials.
				console.error(`[TwilioVerifyProvider] startVerification failed with status ${res.status}`);
				return { success: false, error: 'provider_error' };
			}
			return { success: true };
		} catch (err) {
			console.error('[TwilioVerifyProvider] startVerification request failed:', err instanceof Error ? err.message : String(err));
			return { success: false, error: 'provider_unavailable' };
		}
	}

	async checkVerification(phone: string, code: string): Promise<OtpResult> {
		try {
			const res = await fetch(`https://verify.twilio.com/v2/Services/${this.config.verifyServiceSid}/VerificationCheck`, {
				method: 'POST',
				headers: {
					authorization: this.authHeader(),
					'content-type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({ To: phone, Code: code }),
			});
			if (!res.ok) {
				console.error(`[TwilioVerifyProvider] checkVerification failed with status ${res.status}`);
				return { success: false, error: 'provider_error' };
			}
			const data = (await res.json()) as { status?: string };
			if (data.status !== 'approved') {
				return { success: false, error: 'invalid_code' };
			}
			return { success: true };
		} catch (err) {
			console.error('[TwilioVerifyProvider] checkVerification request failed:', err instanceof Error ? err.message : String(err));
			return { success: false, error: 'provider_unavailable' };
		}
	}
}

// ============================================================================
// Provider selection — explicit and fail-closed
// ============================================================================
// OTP_PROVIDER must be exactly "mock" or "twilio". There is no default and
// no inference from which credentials happen to be configured — a missing
// or unrecognized value throws rather than silently choosing either
// provider. "twilio" with any of the three credentials missing also
// throws: a production deployment that forgot to configure Twilio secrets
// must fail loudly, never fall back to development OTP behavior. The mock
// additionally refuses to do anything (see MockOtpProvider above) if
// ENVIRONMENT isn't "development", so even a misconfigured
// OTP_PROVIDER=mock outside development cannot generate/accept real OTPs.
export interface ProviderEnv {
	ENVIRONMENT: string;
	OTP_PROVIDER?: string;
	TWILIO_ACCOUNT_SID?: string;
	TWILIO_AUTH_TOKEN?: string;
	TWILIO_VERIFY_SERVICE_SID?: string;
}

export function getOtpProvider(env: ProviderEnv): OtpProvider {
	if (env.OTP_PROVIDER === 'mock') {
		if (env.ENVIRONMENT !== 'development') {
			throw new Error('OTP_PROVIDER=mock is not permitted outside development.');
		}
		return new MockOtpProvider(env.ENVIRONMENT);
	}

	if (env.OTP_PROVIDER === 'twilio') {
		if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID) {
			throw new Error('OTP_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID to all be set.');
		}
		return new TwilioVerifyProvider({
			accountSid: env.TWILIO_ACCOUNT_SID,
			authToken: env.TWILIO_AUTH_TOKEN,
			verifyServiceSid: env.TWILIO_VERIFY_SERVICE_SID,
		});
	}

	throw new Error(`OTP_PROVIDER must be "mock" or "twilio" — got ${JSON.stringify(env.OTP_PROVIDER)}.`);
}
