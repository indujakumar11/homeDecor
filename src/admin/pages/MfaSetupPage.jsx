import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, QrCode, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isCurrentUserEnabledAdmin, enrollBackupTotpFactor, unenrollTotpFactor } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

// ============================================================================
// Admin TOTP enrollment — client first-time setup (Phase 6B) +
// backup-authenticator enrollment (BACKUP TOTP phase)
// ============================================================================
// Originated in Phase 2 as a throwaway test harness; now the real,
// production first-time-setup page an enabled admin is routed to by
// LoginPage.jsx (no verified TOTP yet) or ProtectedRoute.jsx ('no-totp').
// Still entirely additive and self-contained — does NOT touch LoginPage's
// password step, OtpPage.jsx, authService.login()/verifyOtp(), the Worker's
// OTP routes, otpProvider.ts, x-otp-proof, otp_authorizations, or the
// custom access token hook.
//
// Phase 6B SECURITY FIX: previously this page only checked for a plain
// session before starting enrollment — ANY authenticated Supabase account
// (signup is open) could reach it and enroll/verify its own TOTP factor.
// It now also requires isCurrentUserEnabledAdmin() (the same
// SECURITY DEFINER admin_users check used by ProtectedRoute.jsx) to pass
// BEFORE listFactors()/enroll() is ever called — a non-admin sees only an
// "unauthorized" message, never the QR code, secret, or enrollment UI.
// TOTP enrollment itself still does not grant admin authorization — the
// Worker and RLS independently and exclusively decide that, unchanged.
//
// BACKUP TOTP phase: this same page now also serves a second mode, entered
// via the `?mode=add` query param (from SecuritySettingsPage.jsx's "Add
// authenticator" button). In that mode, an existing VERIFIED factor is the
// expected normal case (the primary) rather than a stop condition, and a
// brand-new, independent factor is enrolled via enrollBackupTotpFactor() —
// a fresh Supabase-generated secret, never the primary's. The admin gate,
// QR/secret display, challenge/verify, and explicit AAL2 confirmation below
// are identical code paths for both modes; only what happens around an
// existing verified factor, and where the page navigates to on success,
// differs.
// ============================================================================

function mapMfaError(error) {
  // Supabase's own MFA error messages are plain, user-facing, non-secret
  // strings (e.g. "Invalid TOTP code", "MFA is not enabled for this
  // project") — safe to surface directly. Never includes tokens/secrets.
  if (error?.message) return error.message;
  return 'Something went wrong. Please try again.';
}

const MfaSetupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Mode 2 (add backup) vs mode 1 (first-time setup) — see header comment.
  const isAddMode = searchParams.get('mode') === 'add';
  // 'checking' | 'no-session' | 'not-admin' | 'loading-factors' |
  // 'already-verified' | 'pending-factor-found' | 'enrolling' |
  // 'awaiting-code' | 'verifying' | 'verified' | 'cancelling' | 'error'
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');

  const [existingFactor, setExistingFactor] = useState(null);
  const [pendingFactor, setPendingFactor] = useState(null);

  const [factorId, setFactorId] = useState(null);
  const [qrCode, setQrCode] = useState(null); // SVG markup or data: URI, from Supabase directly
  const [secret, setSecret] = useState(null);
  const [otpauthUri, setOtpauthUri] = useState(null);

  const [code, setCode] = useState('');

  const [assuranceResult, setAssuranceResult] = useState(null);

  // Mode 1 — first-time setup: the account's PRIMARY factor.
  const startEnrollment = async () => {
    setStatus('enrolling');
    setError('');
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Primary authenticator',
      });
      if (enrollError) {
        setError(mapMfaError(enrollError));
        setStatus('error');
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp?.qr_code ?? null);
      setSecret(data.totp?.secret ?? null);
      setOtpauthUri(data.totp?.uri ?? null);
      setStatus('awaiting-code');
    } catch {
      setError('Network error while starting enrollment. Please check your connection and try again.');
      setStatus('error');
    }
  };

  // Mode 2 — add backup: a brand-new, independent factor. Supabase
  // generates its own fresh secret server-side (see authService.js's
  // enrollBackupTotpFactor()) — the primary factor's secret is never read
  // or reused.
  const startBackupEnrollment = async () => {
    setStatus('enrolling');
    setError('');
    const result = await enrollBackupTotpFactor();
    if (!result.success) {
      setError(result.message);
      setStatus('error');
      return;
    }
    setFactorId(result.factorId);
    setQrCode(result.qrCode);
    setSecret(result.secret);
    setOtpauthUri(result.otpauthUri);
    setStatus('awaiting-code');
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sessionData.session) {
        setStatus('no-session');
        return;
      }

      // Phase 6B: must pass BEFORE listFactors()/enroll() is ever called —
      // a non-admin must never see the QR code, secret, or enrollment UI at
      // all. See authService.js's isCurrentUserEnabledAdmin().
      const isAdmin = await isCurrentUserEnabledAdmin();
      if (cancelled) return;
      if (!isAdmin) {
        setStatus('not-admin');
        return;
      }

      setStatus('loading-factors');
      let factorsResult;
      try {
        factorsResult = await supabase.auth.mfa.listFactors();
      } catch {
        if (!cancelled) {
          setError('Network error while checking existing authenticator factors. Please try again.');
          setStatus('error');
        }
        return;
      }
      if (cancelled) return;

      const { data: factorsData, error: factorsError } = factorsResult;
      if (factorsError) {
        setError(mapMfaError(factorsError));
        setStatus('error');
        return;
      }

      const totpFactors = factorsData?.totp ?? [];

      // A pending, never-completed enrollment (of EITHER mode — a prior
      // abandoned primary setup or a prior abandoned backup attempt)
      // exists from an earlier attempt. Supabase has no API to re-fetch
      // that factor's QR/secret (enroll() only ever returns it once, at
      // creation time), so it can't be resumed — only explained. We do NOT
      // auto-start a new enrollment here; the admin must explicitly
      // choose to (and can also remove it from Security Settings instead —
      // see unenrollTotpFactor()). Checked before the mode branch below so
      // a leftover pending factor is never silently buried under a second
      // one.
      const unverifiedFactor = totpFactors.find((f) => f.status === 'unverified');
      if (unverifiedFactor) {
        setPendingFactor(unverifiedFactor);
        setStatus('pending-factor-found');
        return;
      }

      if (isAddMode) {
        // Mode 2: an existing verified factor (the primary) is the
        // expected, normal case here — never a stop condition. Go straight
        // to enrolling a new, independent backup factor.
        await startBackupEnrollment();
        return;
      }

      const verifiedFactor = totpFactors.find((f) => f.status === 'verified');
      if (verifiedFactor) {
        // Mode 1 only: a verified factor already exists — per Phase 2's
        // explicit safety rule, we never call enroll() again automatically
        // in this case.
        setExistingFactor(verifiedFactor);
        setStatus('already-verified');
        return;
      }

      // No factor at all yet — proceed straight to enrollment, matching
      // the expected flow (no extra confirmation click needed for the
      // first-ever attempt).
      await startEnrollment();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code exactly as shown in your authenticator app.');
      return;
    }

    setStatus('verifying');
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        setError(mapMfaError(challengeError));
        setStatus('awaiting-code');
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) {
        setError(mapMfaError(verifyError));
        setStatus('awaiting-code');
        return;
      }

      // Phase 6B: verify() succeeding is not itself treated as "done" —
      // explicitly require currentLevel === 'aal2' before ever claiming
      // success or proceeding anywhere. If this session somehow didn't
      // reach aal2, show an error and stay here rather than displaying a
      // misleading confirmation.
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || aalData?.currentLevel !== 'aal2') {
        setError('Verification succeeded, but the session did not reach the required security level. Please try again.');
        setStatus('awaiting-code');
        return;
      }
      setAssuranceResult(aalData);
      setStatus('verified');
      // Brief confirmation beat (matches this project's existing
      // save-success-then-navigate convention, e.g. EditImagePage.jsx)
      // before continuing on — ProtectedRoute independently re-verifies
      // everything on arrival regardless. Mode 2 returns to Security
      // Settings (where the newly-verified backup factor will now show
      // up via a fresh listTotpFactors() call); mode 1 continues into the
      // admin dashboard exactly as before.
      setTimeout(() => {
        if (isAddMode) {
          navigate('/admin/security', { replace: true, state: { justAdded: true } });
        } else {
          navigate('/admin/gallery', { replace: true });
        }
      }, 1200);
    } catch {
      setError('Network error during verification. Please check your connection and try again.');
      setStatus('awaiting-code');
    }
  };

  // BACKUP TOTP CLEANUP — the fix for this phase. Only ever relevant in
  // add mode: mode 1 (first-time primary setup) must keep its existing
  // behavior exactly as-is (an abandoned primary enrollment is left in
  // place, same as before — see the "pending-factor-found" branch above),
  // per this phase's explicit requirement not to touch that flow.
  //
  // Only attempts cleanup when status is EXACTLY 'awaiting-code' — i.e. a
  // factor from THIS CURRENT enroll() call exists and no verify attempt
  // has been submitted for it yet. Deliberately excludes 'verifying'
  // (a verify() call may already be in flight for this exact factor; a
  // concurrent unenroll() could otherwise race a successful verification
  // and delete a factor that just became verified — see the
  // IMPORTANT FACTOR ID SAFETY discussion in this phase's report) and
  // 'verified' (nothing to clean up — the factor is done and must be kept).
  // unenrollTotpFactor() itself re-checks the factor's CURRENT server-side
  // status before doing anything, so even this is defense in depth, not
  // the only guard.
  const handleExit = async () => {
    const target = isAddMode ? '/admin/security' : '/admin/gallery';

    if (isAddMode && factorId && status === 'awaiting-code') {
      setStatus('cancelling');
      const result = await unenrollTotpFactor(factorId);
      if (!result.success) {
        setError(result.message);
        setStatus('awaiting-code');
        return;
      }
    }

    navigate(target, { replace: true });
  };

  if (status === 'no-session') {
    return <Navigate to="/admin/login" replace />;
  }

  const renderQr = () => {
    if (!qrCode) return null;
    // Supabase returns the TOTP QR code already rendered server-side,
    // either as a data: URI (renderable directly via <img>) or as raw SVG
    // markup — handled defensively since the exact shape isn't something
    // this app controls. Either way this is OUR OWN trusted Auth response,
    // never user-supplied input.
    if (qrCode.startsWith('data:')) {
      return <img src={qrCode} alt="Scan this QR code with your authenticator app" width={200} height={200} />;
    }
    return <div aria-label="Scan this QR code with your authenticator app" dangerouslySetInnerHTML={{ __html: qrCode }} />;
  };

  return (
    <div className={styles.authScreen}>
      <div className={styles.authCard}>
        <div className={styles.brandBlock}>
          <span className={styles.brandTitle}>BLACK SHADES</span>
          <span className={styles.brandSub}>ADMIN PORTAL</span>
        </div>

        <h1 className={styles.heading}>{isAddMode ? 'Add a backup authenticator' : 'Set up your authenticator'}</h1>
        {status !== 'not-admin' && (
          <p className={styles.subheading}>
            {isAddMode
              ? 'Set up a second authenticator app as a backup. Either one can be used to sign in, so losing one device will not lock you out.'
              : 'Your admin account requires two-factor authentication. Use an authenticator app such as Google Authenticator or Microsoft Authenticator.'}
          </p>
        )}

        <InlineAlert type="error" message={error} className={styles.alert} />

        {(status === 'checking' || status === 'loading-factors' || status === 'enrolling') && (
          <p className={styles.subheading}>Loading…</p>
        )}

        {status === 'cancelling' && (
          <p className={styles.subheading}>Cancelling…</p>
        )}

        {status === 'not-admin' && (
          <InlineAlert
            type="error"
            message="You are not authorized to set up admin two-factor authentication."
            className={styles.alert}
          />
        )}

        {status === 'already-verified' && existingFactor && (
          <>
            <InlineAlert
              type="success"
              message="An authenticator app is already enrolled and verified for this account."
              className={styles.alert}
            />
            <p className={styles.subheading}>
              Factor ID: <strong>{existingFactor.id}</strong>
              <br />
              Created: {existingFactor.created_at ? new Date(existingFactor.created_at).toLocaleString() : 'n/a'}
            </p>
            <p className={styles.subheading}>
              To avoid accidentally creating a second, confusing factor, this page will not start a new enrollment
              while a verified one already exists.
            </p>
          </>
        )}

        {status === 'pending-factor-found' && pendingFactor && (
          <>
            <InlineAlert
              type="error"
              message="An unverified authenticator setup already exists from a previous attempt."
              className={styles.alert}
            />
            <p className={styles.subheading}>
              Factor ID: <strong>{pendingFactor.id}</strong>. Supabase does not allow re-displaying that factor's QR
              code — if you still have it scanned in your authenticator app, you won't be able to complete it here.
              Starting a fresh enrollment below leaves the old pending factor in place (harmless — it never reaches
              &quot;verified&quot; and grants nothing); it can be removed from Security Settings → Authenticator
              factors at any time.
            </p>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={isAddMode ? startBackupEnrollment : startEnrollment}
            >
              <QrCode size={16} />
              <span>Start a new enrollment</span>
            </button>
          </>
        )}

        {(status === 'awaiting-code' || status === 'verifying') && (
          <>
            <ol className={styles.subheading} style={{ textAlign: 'left' }}>
              <li>Install or open Google Authenticator, Microsoft Authenticator, or another TOTP-compatible authenticator app.</li>
              <li>Scan the QR code below (or use the manual setup key if you can&apos;t scan).</li>
              <li>Enter the 6-digit code shown by the app.</li>
              <li>Verify.</li>
            </ol>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>{renderQr()}</div>

            {(secret || otpauthUri) && (
              <div className={styles.field}>
                <label className={styles.label}>Can&apos;t scan? Manual setup key</label>
                {secret && (
                  <p className={styles.subheading} style={{ wordBreak: 'break-all' }}>
                    Secret key: <strong>{secret}</strong>
                  </p>
                )}
                {otpauthUri && (
                  <p className={styles.subheading} style={{ wordBreak: 'break-all' }}>
                    URI: <code>{otpauthUri}</code>
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleVerify} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="totp-code" className={styles.label}>6-digit code</label>
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={`${styles.input} ${styles.otpInput}`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={status === 'verifying'}>
                <ShieldCheck size={16} />
                <span>{status === 'verifying' ? 'Verifying…' : 'Verify TOTP'}</span>
              </button>
            </form>
          </>
        )}

        {status === 'verified' && (
          <>
            <InlineAlert
              type="success"
              message={isAddMode ? 'Backup authenticator added' : 'Authenticator setup successful'}
              className={styles.alert}
            />
            <p className={styles.subheading}>
              Security level: <strong>{assuranceResult?.currentLevel ?? 'unknown'}</strong>
            </p>
            <p className={styles.subheading}>
              {isAddMode ? 'Taking you back to Security settings…' : 'Taking you to the admin dashboard…'}
            </p>
          </>
        )}

        {status === 'not-admin' ? (
          <p className={styles.hint}>
            <Link to="/admin/login">
              <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              Back to login
            </Link>
          </p>
        ) : isAddMode ? (
          // Mode 2 only — a button, not a plain Link, because leaving this
          // page while the backup factor created by THIS attempt is still
          // unverified must first unenroll it (see handleExit above). Mode
          // 1 (the `else` branch below) stays a plain, unchanged Link:
          // first-time primary setup must never attempt this cleanup.
          <p className={styles.hint}>
            <button
              type="button"
              className={styles.hintLinkBtn}
              onClick={handleExit}
              disabled={status === 'cancelling'}
            >
              <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              Return to Security settings
            </button>
          </p>
        ) : (
          <p className={styles.hint}>
            <Link to="/admin/gallery">
              <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              Return to admin area
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default MfaSetupPage;
