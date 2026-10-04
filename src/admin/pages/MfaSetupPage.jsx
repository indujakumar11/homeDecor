import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, QrCode, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isCurrentUserEnabledAdmin } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

// ============================================================================
// Admin TOTP enrollment — client first-time setup (Phase 6B)
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
  // 'checking' | 'no-session' | 'not-admin' | 'loading-factors' |
  // 'already-verified' | 'pending-factor-found' | 'enrolling' |
  // 'awaiting-code' | 'verifying' | 'verified' | 'error'
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

  const startEnrollment = async () => {
    setStatus('enrolling');
    setError('');
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
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
      const verifiedFactor = totpFactors.find((f) => f.status === 'verified');
      if (verifiedFactor) {
        // A verified factor already exists — per Phase 2's explicit safety
        // rule, we never call enroll() again automatically in this case.
        setExistingFactor(verifiedFactor);
        setStatus('already-verified');
        return;
      }

      const unverifiedFactor = totpFactors.find((f) => f.status === 'unverified');
      if (unverifiedFactor) {
        // A pending, never-completed enrollment exists from an earlier
        // attempt. Supabase has no API to re-fetch that factor's QR/secret
        // (enroll() only ever returns it once, at creation time), so it
        // can't be resumed — only explained. We do NOT auto-start a new
        // enrollment here; the admin must explicitly choose to.
        setPendingFactor(unverifiedFactor);
        setStatus('pending-factor-found');
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
      // before continuing to the admin dashboard — ProtectedRoute
      // independently re-verifies everything on arrival regardless.
      setTimeout(() => navigate('/admin/gallery', { replace: true }), 1200);
    } catch {
      setError('Network error during verification. Please check your connection and try again.');
      setStatus('awaiting-code');
    }
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

        <h1 className={styles.heading}>Set up your authenticator</h1>
        {status !== 'not-admin' && (
          <p className={styles.subheading}>
            Your admin account requires two-factor authentication. Use an authenticator app such as Google
            Authenticator or Microsoft Authenticator.
          </p>
        )}

        <InlineAlert type="error" message={error} className={styles.alert} />

        {(status === 'checking' || status === 'loading-factors' || status === 'enrolling') && (
          <p className={styles.subheading}>Loading…</p>
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
              &quot;verified&quot; and grants nothing) rather than deleting it; this page does not implement factor
              deletion.
            </p>
            <button type="button" className={styles.submitBtn} onClick={startEnrollment}>
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
            <InlineAlert type="success" message="Authenticator setup successful" className={styles.alert} />
            <p className={styles.subheading}>
              Security level: <strong>{assuranceResult?.currentLevel ?? 'unknown'}</strong>
            </p>
            <p className={styles.subheading}>Taking you to the admin dashboard…</p>
          </>
        )}

        {status === 'not-admin' ? (
          <p className={styles.hint}>
            <Link to="/admin/login">
              <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              Back to login
            </Link>
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
