/**
 * ============================================================================
 * ADMIN AUTHENTICATION SERVICE
 * ============================================================================
 * login()/logout()/isAuthenticated()/getCurrentUser() use real Supabase Auth
 * (email + password) via the shared client in src/lib/supabase. Supabase
 * owns that session (JWT storage + refresh) — this module never stores a
 * password or token itself.
 *
 * verifyOtp()/startOtpChallenge()/logout() talk to the Worker's
 * /api/otp/start, /api/otp/verify, and /api/otp/revoke routes
 * (worker/src/index.ts) — the only OTP routes the Worker exposes. This file
 * has no idea whether the Worker is actually using the local development
 * mock or real Twilio Verify behind those routes — see
 * worker/otpProvider.ts for that selection.
 *
 * The OTP proof returned on success is a short-lived, Worker-signed token
 * proving "this Supabase user completed this project's custom OTP gate
 * recently" — it is an application-level second-factor check THIS CODEBASE
 * invented and verifies itself, NOT a Supabase-native AAL2/MFA session;
 * Supabase's own session has no awareness of it. It is stored in
 * sessionStorage (cleared when the tab closes) purely as a client-side
 * convenience so ProtectedRoute/uploadService can attach it to requests —
 * it is NOT the real security boundary. The Worker independently
 * re-verifies this proof's signature, type tag, expiry, and owning user on
 * every privileged request (see requireOtpVerifiedUser in
 * worker/src/index.ts); a forged, expired, malformed, or wrong-user proof
 * is rejected there regardless of what the browser claims. The structural
 * checks in getOtpProof()/hasValidOtpProof() below are a UX nicety (redirect
 * early instead of waiting for a 401) — they cannot verify the signature
 * (this code has no access to OTP_PROOF_SECRET), so they are not a
 * substitute for the Worker's own check.
 *
 * Step 3D: successful OTP verification also establishes a SEPARATE,
 * server-controlled authorization signal used by the *database* — a Postgres
 * Custom Access Token Hook stamps `app_metadata.otp_verified` into a fresh
 * Supabase access token once the Worker records that authorization (see
 * supabase/migrations/003_otp_verified_rls.sql). The access token minted at
 * signInWithPassword() time is issued BEFORE OTP verification and can never
 * retroactively gain that claim — a JWT is immutable once signed — so
 * verifyOtp() below explicitly forces a new token via
 * supabase.auth.refreshSession() once the Worker confirms the claim is
 * ready. Nothing in this file (or anywhere in React) sets, decodes, or
 * relies on that claim directly; it exists purely so Supabase's own RLS
 * policies can require it independently of ProtectedRoute/the Worker.
 * ============================================================================
 */
import { supabase } from '../lib/supabase';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';
const OTP_PROOF_KEY = 'hd_admin_otp_proof';
// Must match OTP_PROOF_TYPE in worker/src/index.ts — a token tagged with
// any other value (an old format, or some future unrelated signed token)
// is never treated as a valid OTP proof.
const OTP_PROOF_TYPE = 'dev-otp-proof-v1';

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Real Supabase email/password sign-in. On success, Supabase has already
 * established a managed session. This then starts an OTP challenge via the
 * Worker (mock locally, Twilio Verify in production — see
 * worker/otpProvider.ts) so the existing OtpPage flow can continue.
 */
export async function login(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.session) {
    return { success: false, message: mapSignInError(error) };
  }

  const startResult = await startOtpChallenge(data.session.access_token);
  if (!startResult.success) {
    return startResult;
  }

  return { success: true };
}

function mapSignInError(error) {
  // Supabase returns 400 for bad credentials and 422 for malformed input
  // (e.g. invalid email format) — both map to the same user-facing message
  // so we never confirm/deny which part of the credential pair was wrong.
  if (error?.status === 400 || error?.status === 422) {
    return 'Invalid email or password.';
  }
  return 'Unable to sign in. Please try again.';
}

async function startOtpChallenge(accessToken) {
  try {
    const response = await fetch(`${WORKER_URL}/api/otp/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, message: 'Your session has expired. Please log in again.' };
      }
      return { success: false, message: 'Unable to send verification code. Please try again.' };
    }

    return { success: true };
  } catch {
    return { success: false, message: 'Verification service unavailable. Please try again.' };
  }
}

/**
 * Step 2 of the login UI flow: verifies the OTP against the Worker's
 * pending challenge for the currently authenticated Supabase user. On
 * success, stores the returned OTP proof (see module docstring) so
 * ProtectedRoute and uploadService can present it on subsequent requests.
 */
export async function verifyOtp(otp) {
  if (!otp) {
    return { success: false, message: 'Invalid OTP.' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, message: 'Your session has expired. Please log in again.' };
  }

  let response;
  try {
    response = await fetch(`${WORKER_URL}/api/otp/verify`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ otp: otp.trim() }),
    });
  } catch {
    return { success: false, message: 'Verification service unavailable. Please try again.' };
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    // fall through — result stays null, handled below
  }

  if (!response.ok || !result?.success) {
    return { success: false, message: result?.message || 'Unable to verify code. Please try again.' };
  }

  storeOtpProof(result.otpProof);

  // The Worker has now recorded server-side OTP authorization (Step 3D),
  // but the access token already held by this tab was minted before that
  // happened and cannot contain the resulting claim. Force a fresh token so
  // the very next database request already carries it — without this,
  // decor_items writes would keep failing under the new RLS policies even
  // though the OTP step just succeeded, until whatever token Supabase's own
  // background timer happens to mint next.
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    return { success: false, message: 'Unable to finish verification. Please try again.' };
  }

  return { success: true };
}

/**
 * Whether an admin has passed step 1 (a Supabase session exists) and the
 * OTP step is therefore relevant. Used by OtpPage to decide whether to
 * render the form or bounce back to Login — it deliberately does not care
 * whether OTP was already completed in this tab (re-verifying is harmless).
 */
export async function hasPendingOtp() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

function storeOtpProof(token) {
  try {
    sessionStorage.setItem(OTP_PROOF_KEY, token);
  } catch {
    // non-fatal — see module docstring: this is a client-side convenience,
    // not the real security boundary.
  }
}

function base64urlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(padded);
}

/**
 * Decodes (does NOT verify — this code has no access to OTP_PROOF_SECRET)
 * the payload of an OTP proof token, returning { typ, sub, exp } or null if
 * the token isn't even well-formed. Used only for the client-side
 * structural/expiry/user-binding sanity checks below.
 */
function decodeOtpProofPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const payload = JSON.parse(base64urlDecode(parts[0]));
    if (typeof payload?.sub !== 'string' || typeof payload?.exp !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Returns the current OTP proof token, or null if missing, malformed, of
 * the wrong type/version, or expired. This is only ever sent to the
 * Worker, which independently re-verifies its signature — see module
 * docstring.
 */
export function getOtpProof() {
  try {
    const token = sessionStorage.getItem(OTP_PROOF_KEY);
    if (!token) return null;

    const payload = decodeOtpProofPayload(token);
    if (!payload || payload.typ !== OTP_PROOF_TYPE || Date.now() >= payload.exp) {
      sessionStorage.removeItem(OTP_PROOF_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Whether a present, well-formed, not-yet-expired OTP proof exists AND
 * belongs to the given (current) Supabase user id. Callers should pass the
 * id from their own already-fetched session (e.g. ProtectedRoute already
 * calls getSession() itself) rather than have this function fetch it again.
 */
export function hasValidOtpProof(userId) {
  const token = getOtpProof();
  if (!token || !userId) return false;
  const payload = decodeOtpProofPayload(token);
  return Boolean(payload && payload.sub === userId);
}

function clearOtpProof() {
  try {
    sessionStorage.removeItem(OTP_PROOF_KEY);
  } catch {
    // non-fatal
  }
}

/**
 * Clears the real Supabase session, the local OTP proof, and (best-effort)
 * the server-side OTP authorization record — so a later login does not
 * silently inherit this session's OTP-verified status. Revocation is
 * attempted before signing out (it needs the still-valid access token to
 * identify the user) but NEVER blocks logout: bounded by a short timeout
 * (an unreachable or hung Worker must not leave the admin UI looking
 * authenticated), and local session/proof clearing always runs regardless
 * of whether the Worker call succeeded, timed out, or errored. If it
 * didn't succeed, the stale server-side record simply expires on its own
 * (see worker/src/index.ts's own comments on this residual limitation).
 */
export async function logout() {
  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      await fetch(`${WORKER_URL}/api/otp/revoke`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch {
      // non-fatal (network error, timeout, or Worker unreachable) — see
      // function docstring. Local sign-out below always proceeds.
    }
  }

  clearOtpProof();
  await supabase.auth.signOut();
}

/** Whether a valid Supabase session currently exists (does not check OTP). */
export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

/** The current Supabase Auth user, or null if not signed in. */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}
