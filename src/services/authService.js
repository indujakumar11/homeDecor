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
import { supabase, createReauthClient } from '../lib/supabase';

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

// ============================================================================
// PHASE 3 — Supabase native TOTP MFA (additive, alongside the OTP flow above)
// ============================================================================
// Everything above this point (login(), startOtpChallenge(), verifyOtp(),
// the OTP proof helpers, logout()'s otp_authorizations revoke call) is the
// EXISTING Twilio/mock OTP system — untouched, still fully functional, and
// still reachable via the old /admin/otp page if it's ever navigated to
// directly. The functions below are a SEPARATE, parallel path used only by
// the new login flow (LoginPage.jsx) and the new /admin/mfa page
// (MfaVerifyPage.jsx). Nothing below writes to sessionStorage/localStorage
// — Supabase's own session + AAL state (native MFA) is the sole source of
// truth here, per this phase's explicit requirement.

/**
 * Password-only sign-in — deliberately does NOT call startOtpChallenge()
 * the way login() above does. The caller (LoginPage.jsx) decides what to
 * do next itself, based on whether the account has a verified TOTP factor
 * (see getVerifiedTotpFactor below), rather than this function assuming
 * the old Worker OTP flow should always run.
 */
export async function loginWithPassword(email, password) {
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

  return { success: true };
}

/**
 * Returns the current user's verified TOTP factor, or null if they have
 * none (including if they only have an unverified/pending one — that is
 * deliberately never treated as sufficient). Returns null on any error
 * too, so callers fail closed (treat it the same as "no factor").
 */
export async function getVerifiedTotpFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  const totpFactors = data?.totp ?? [];
  return totpFactors.find((f) => f.status === 'verified') ?? null;
}

/**
 * Starts a Supabase MFA challenge for an already-enrolled, verified TOTP
 * factor. Never enrolls anything — the factor must already exist (see
 * MfaSetupPage.jsx for enrollment, untouched by this phase).
 */
export async function createTotpChallenge(factorId) {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) {
    return { success: false, message: error.message || 'Unable to start verification. Please try again.' };
  }
  return { success: true, challengeId: data.id };
}

/**
 * Verifies a submitted TOTP code against an existing challenge, then
 * explicitly re-checks the resulting session's assurance level rather than
 * trusting a successful verify() call alone — aal2 is the only acceptable
 * outcome for admin access in this phase.
 */
export async function verifyTotpChallenge(factorId, challengeId, code) {
  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (verifyError) {
    return { success: false, message: verifyError.message || 'Invalid or expired code. Please try again.' };
  }

  const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aalData?.currentLevel !== 'aal2') {
    return {
      success: false,
      message: 'Verification succeeded, but the session did not reach the required security level. Please try again.',
    };
  }

  return { success: true };
}

/** True only if the CURRENT Supabase session has actually reached aal2. */
export async function hasAal2Session() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false;
  return data?.currentLevel === 'aal2';
}

// ============================================================================
// PHASE 6B — frontend admin-allowlist check
// ============================================================================
// public.admin_users has RLS enabled with ZERO policies for `authenticated`/
// `anon` and an explicit `revoke all ... from authenticated, anon, public`
// (see supabase/migrations/004_admin_authorization_hardening.sql) — the
// browser can never SELECT it directly, by design, and this function does
// NOT change that. Instead it calls the EXISTING SECURITY DEFINER function
// public.is_enabled_admin() (supabase/migrations/008_aal2_decor_items_
// authorization.sql — already granted EXECUTE to `authenticated`, created
// for Phase 5A's RLS policies, not a new function added for this). That
// function takes NO parameters — it reads auth.uid() internally — so a
// caller can only ever ask "am I an enabled admin," never "is some other
// user id an enabled admin." admin_users itself remains fully locked down;
// nothing about its RLS/grants changes because of this.
//
// IMPORTANT DEPLOYMENT DEPENDENCY: migration 008 has not yet been pushed to
// production as of this writing (Phase 5A stopped awaiting approval) — this
// function will fail closed (return false, via the `error` branch) in any
// environment where that migration hasn't been applied yet, since the RPC
// function won't exist there. It must be pushed before this works in
// production — see the Phase 6B report.
//
// This is a UI-gating convenience only, exactly like the existing aal2/
// OTP-proof checks elsewhere in this file — the Worker (authorizeAdminRequest)
// and RLS (is_enabled_admin() used directly in policies) remain the real,
// independently-enforced authorization boundary for any privileged
// operation. This function being wrong/unavailable can only ever make the
// frontend MORE restrictive (fails closed to `false`), never less.
export async function isCurrentUserEnabledAdmin() {
  const { data, error } = await supabase.rpc('is_enabled_admin');
  if (error) return false;
  return data === true;
}

// ============================================================================
// BACKUP TOTP AUTHENTICATOR (additive — see audit report for this phase)
// ============================================================================
// Everything below is purely additive on top of the Phase 3 TOTP functions
// above (createTotpChallenge/verifyTotpChallenge/getVerifiedTotpFactor,
// unchanged, still used as-is for the single-factor case). These let an
// account have a SECOND, independent Supabase TOTP factor ("backup") without
// touching the Worker or RLS at all — both already authorize purely on the
// session's `aal` claim + admin_users.enabled, never on which factor
// produced that claim (confirmed by reading worker/src/index.ts's
// tryAal2AdminAuthorization and migration 008's RLS policies).

/**
 * All of the current user's VERIFIED totp factors (plural — unlike
 * getVerifiedTotpFactor() above, which intentionally returns only the
 * first one for the existing single-factor call sites).
 *
 * Deliberately filters `data.all` by factor_type/status itself rather than
 * trusting `data.totp` to already be verified-only: the installed
 * @supabase/auth-js@2.112.4 types declare `data.totp` as
 * `Factor<'totp', 'verified'>[]`, but getVerifiedTotpFactor() above has
 * always re-checked `status === 'verified'` at runtime regardless — that
 * existing defensiveness is kept and applied here too rather than trusting
 * the type.
 */
export async function getVerifiedTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return [];
  const all = data?.all ?? [];
  return all.filter((f) => f.factor_type === 'totp' && f.status === 'verified');
}

/**
 * Every TOTP factor on the current user's account, verified or not, for
 * display on the Security settings page. Returns exactly the fields
 * Supabase provides on a Factor (id, friendly_name, factor_type, status,
 * created_at, updated_at, last_challenged_at) — nothing invented, no
 * secret ever included (listFactors() never returns one).
 */
export async function listTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return [];
  const all = data?.all ?? [];
  return all.filter((f) => f.factor_type === 'totp');
}

/**
 * Enrolls a brand-new, independent TOTP factor labeled "Backup
 * authenticator" — Supabase generates a fresh secret server-side; this
 * never reads, reuses, or displays any existing factor's secret (it has no
 * way to — listFactors() never returns one). Returns the same shape
 * MfaSetupPage.jsx already uses for the primary-factor enrollment UI, so
 * both modes can share one QR/secret render path.
 */
export async function enrollBackupTotpFactor() {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Backup authenticator',
  });

  if (error) {
    return {
      success: false,
      message: error.message || 'Unable to start backup authenticator setup. Please try again.',
    };
  }

  return {
    success: true,
    factorId: data.id,
    qrCode: data.totp?.qr_code ?? null,
    secret: data.totp?.secret ?? null,
    otpauthUri: data.totp?.uri ?? null,
  };
}

/**
 * Removes a TOTP factor, but first re-fetches the CURRENT factor list from
 * Supabase and recomputes the verified count itself — it never trusts a
 * caller-supplied count or whatever the UI last rendered, specifically to
 * stay correct if another tab/device changed something in between (see
 * audit report edge cases 1-2). An unverified/pending factor can always be
 * removed (it grants no access). A verified factor can only be removed if
 * at least one OTHER verified factor will remain — this is the only place
 * in the app that enforces "never zero verified factors," since Supabase
 * itself has no such rule (it only requires the CALLER'S session to already
 * be aal2 before unenrolling any verified factor — a separate, server-side
 * check this function doesn't need to duplicate).
 *
 * Returns a result object (matching every other function in this file)
 * rather than throwing, so callers can render the message with the same
 * InlineAlert pattern used everywhere else — the "clear error" the caller
 * sees either way.
 */
export async function unenrollTotpFactor(factorId) {
  if (!factorId) {
    return { success: false, message: 'Missing authenticator id.' };
  }

  const { data, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) {
    return {
      success: false,
      message: listError.message || 'Unable to check current authenticators. Please try again.',
    };
  }

  const all = data?.all ?? [];
  const target = all.find((f) => f.id === factorId && f.factor_type === 'totp');

  if (!target) {
    // Already gone — e.g. removed from another tab between this page's
    // load and this click. Nothing to do; the caller should just refresh
    // its list, which will already reflect this.
    return { success: true, alreadyRemoved: true };
  }

  if (target.status === 'verified') {
    const verifiedCount = all.filter((f) => f.factor_type === 'totp' && f.status === 'verified').length;
    if (verifiedCount <= 1) {
      return {
        success: false,
        message: 'At least one verified authenticator must remain. Add another authenticator before removing this one.',
      };
    }
  }

  // Supabase's own server-side response is authoritative from here —
  // including its independent rule that a verified factor can only be
  // unenrolled from an already-aal2 session (see @supabase/auth-js's own
  // unenroll() doc comment), which this function does not need to
  // duplicate.
  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
  if (unenrollError) {
    return {
      success: false,
      message: unenrollError.message || 'Unable to remove this authenticator. Please try again.',
    };
  }

  return { success: true };
}

// ============================================================================
// FORGOT PASSWORD / CHANGE PASSWORD
// ============================================================================
// Both paths use only Supabase Auth's own built-in password-recovery and
// user-update APIs — there is no custom token, no custom email, and
// nothing password-related is ever stored by this app (not in a table, not
// in localStorage/sessionStorage, never logged, never sent to the Worker).
// Neither path touches admin_users, TOTP factors, or AAL in a way that
// weakens them — see the per-function notes below for exactly how each one
// avoids that.
//
// HASH-ROUTER COMPATIBILITY NOTE (read before changing the redirect below):
// This app's router is a HashRouter (see App.jsx) and the installed
// @supabase/auth-js@2.112.4 defaults (confirmed by reading its source,
// nothing overridden in lib/supabase.js) are `flowType: 'implicit'` and
// `detectSessionInUrl: true` — meaning a recovery link redirects back here
// with the new session's tokens appended to the URL as a HASH fragment
// (e.g. `#access_token=...&type=recovery`). If `redirectTo` already
// contained our own `#/admin/...` route path, the browser would only ever
// recognize the FIRST `#` in the URL — everything after it, including
// Supabase's own appended `#access_token=...`, becomes one single opaque
// fragment string. Tracing auth-js's own parseParametersFromURL (splits
// the fragment on `&`/`=`) confirms this corrupts the `access_token` key
// into `/admin/reset-password#access_token`, so `_isImplicitGrantCallback`
// never finds it and Supabase silently never establishes the recovery
// session at all. So requestPasswordReset() below redirects to the bare
// site origin (no path) instead — only one `#` ever exists in that URL —
// and the onAuthStateChange listener a few lines down is what actually
// gets the user to /admin/reset-password, by reacting to Supabase's own
// `PASSWORD_RECOVERY` event (emitted only once it has successfully parsed
// the tokens and established the session) rather than relying on the URL
// path surviving the redirect at all.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      window.location.hash = '#/admin/reset-password';
    }
  });
}

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Requests a password-reset email for the given address via Supabase
 * Auth's own resetPasswordForEmail() — no custom token/email logic.
 * Deliberately returns the SAME generic success message whether or not
 * the address belongs to an account (admin or otherwise): Supabase's own
 * API already doesn't distinguish "no such user" from "sent" in its
 * response, and this function doesn't either, so neither this UI nor any
 * error path it takes can be used to probe which emails exist.
 */
export async function requestPasswordReset(email) {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return { success: false, message: 'Email is required.' };
  }
  if (!EMAIL_FORMAT_RE.test(trimmed)) {
    // A pure syntax check applied identically to ANY input before any
    // network call — reveals nothing about whether an account exists.
    return { success: false, message: 'Enter a valid email address.' };
  }

  const GENERIC_SUCCESS = {
    success: true,
    message: 'If an account exists for this email address, a password reset link has been sent.',
  };

  try {
    // No path in redirectTo — see the HASH-ROUTER COMPATIBILITY NOTE above.
    await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/`,
    });
  } catch {
    // A genuine network-level failure (e.g. fully offline). Still nothing
    // Supabase-specific is surfaced, but this is distinct enough from "no
    // such account" that a plain retry prompt is more honest and more
    // useful than the generic message.
    return { success: false, message: 'Network error. Please check your connection and try again.' };
  }

  // Any OTHER outcome — sent, rate-limited, no such user, etc. — gets the
  // same generic message. Supabase's own resetPasswordForEmail() already
  // returns { error: null } for a non-existent email for this exact reason;
  // this function does not add a path that would leak more than Supabase
  // itself already chooses not to.
  return GENERIC_SUCCESS;
}

/**
 * Sets a new password for the CURRENT session — used by both
 * ResetPasswordPage.jsx (a Supabase-established recovery session, reached
 * via the PASSWORD_RECOVERY flow above) and, indirectly, changePassword()
 * below. Confirmed by reading auth-js's _updateUser(): it patches the
 * existing session's `.user` field and re-saves the SAME access/refresh
 * token pair — it never mints a new session via a fresh grant, so it
 * cannot change the session's aal either way. Whether that matters depends
 * on the caller: a recovery session is aal1 by nature (no TOTP was ever
 * involved in creating it), which is exactly why ResetPasswordPage.jsx
 * signs the user out after calling this rather than letting them into the
 * dashboard on it.
 */
export async function updatePassword(newPassword) {
  if (!newPassword) {
    return { success: false, message: 'Password is required.' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    // Supabase's own update-user error messages are plain, user-facing,
    // non-secret strings (e.g. "Password should be at least 6 characters")
    // — same precedent as mapMfaError() for the MFA pages — safe to surface
    // directly.
    return { success: false, message: error.message || 'Unable to update password. Please try again.' };
  }
  return { success: true };
}

/**
 * Changes the CURRENTLY SIGNED-IN admin's password, first verifying
 * `currentPassword` is actually correct. supabase.auth.updateUser({
 * password }) has no concept of "the old password" — it only requires an
 * already-authenticated session — so without an explicit check here,
 * anyone with access to an already-open, unattended admin tab could
 * silently take over the account.
 *
 * The verification itself runs on a throwaway client (createReauthClient())
 * rather than the shared `supabase` instance specifically because
 * signInWithPassword() always REPLACES the caller's current session with
 * a fresh one, and a fresh password-only sign-in is only ever aal1 — doing
 * that against the admin's real, already-aal2 session would silently
 * downgrade it back to aal1 just to check a password, which this project's
 * AAL2 model must never do (see Phase 4/5A's Worker/RLS aal2 requirement).
 * The real admin session in `supabase` is never touched by the check; only
 * a successful check is allowed to proceed to the real updateUser() call
 * below, which (per updatePassword()'s own note) cannot change the real
 * session's aal either.
 */
export async function changePassword(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    return { success: false, message: 'Current and new password are required.' };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser?.email) {
    return { success: false, message: 'Your session has expired. Please log in again.' };
  }

  const reauthClient = createReauthClient();
  const { error: reauthError } = await reauthClient.auth.signInWithPassword({
    email: currentUser.email,
    password: currentPassword,
  });
  // Best-effort revoke of the throwaway session's own refresh token
  // server-side. This client was never persisted to storage, so skipping
  // this on failure is harmless either way.
  try {
    await reauthClient.auth.signOut();
  } catch {
    // non-fatal
  }

  if (reauthError) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  return updatePassword(newPassword);
}
