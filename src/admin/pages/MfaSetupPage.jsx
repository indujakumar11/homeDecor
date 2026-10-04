import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, QrCode, ArrowLeft } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

// ============================================================================
// TEMPORARY — Phase 2 of the Supabase TOTP MFA migration (audit-approved).
// ============================================================================
// This page exists ONLY to prove that native Supabase TOTP enrollment and
// verification work end-to-end, using a real admin session. It is entirely
// additive and self-contained:
//   - Does NOT touch LoginPage.jsx, OtpPage.jsx, authService.login()/
//     verifyOtp(), the Worker's OTP routes, otpProvider.ts, x-otp-proof,
//     otp_authorizations, the custom access token hook, or ProtectedRoute.
//   - Reaching AAL2 here does NOT grant access to anything — /admin/gallery
//     and every other protected route still require the existing
//     Twilio/mock OTP proof exactly as before. This page's own AAL2 result
//     is displayed for inspection only, never used to gate anything.
//   - Requires only a plain authenticated Supabase session (the same check
//     OtpPage.jsx already uses) — a small, DEDICATED check, intentionally
//     not ProtectedRoute, since ProtectedRoute also requires the existing
//     OTP proof, which would make this page untestable on its own.
// Safe to delete this entire file (and its one route in AdminApp.jsx) once
// Phase 2 testing is complete and the migration moves to later phases, or
// if the migration is abandoned — nothing else in the app depends on it.
// ============================================================================

function mapMfaError(error) {
  // Supabase's own MFA error messages are plain, user-facing, non-secret
  // strings (e.g. "Invalid TOTP code", "MFA is not enabled for this
  // project") — safe to surface directly. Never includes tokens/secrets.
  if (error?.message) return error.message;
  return 'Something went wrong. Please try again.';
}

const MfaSetupPage = () => {
  // 'checking' | 'no-session' | 'loading-factors' | 'already-verified' |
  // 'pending-factor-found' | 'enrolling' | 'awaiting-code' | 'verifying' |
  // 'verified' | 'error'
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
  const [sessionStillValid, setSessionStillValid] = useState(null);

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

      // Verified — confirm the resulting assurance level and that a
      // session still exists, purely for display/testing purposes. Nothing
      // here is stored or used to gate access to anything else.
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setAssuranceResult(aalError ? null : aalData);

      const { data: sessionData } = await supabase.auth.getSession();
      setSessionStillValid(Boolean(sessionData.session));

      setStatus('verified');
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

        <h1 className={styles.heading}>Set up Authenticator App</h1>
        <p className={styles.subheading}>
          Temporary TOTP setup/testing page (Phase 2) — this does not change how you currently log in.
        </p>

        <InlineAlert type="error" message={error} className={styles.alert} />

        {(status === 'checking' || status === 'loading-factors' || status === 'enrolling') && (
          <p className={styles.subheading}>Loading…</p>
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
              <li>Open your authenticator app.</li>
              <li>Scan the QR code below.</li>
              <li>Enter the 6-digit code shown by the app.</li>
              <li>Verify.</li>
            </ol>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>{renderQr()}</div>

            {(secret || otpauthUri) && (
              <div className={styles.field}>
                <label className={styles.label}>Can&apos;t scan? Manual setup</label>
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
            <InlineAlert type="success" message="TOTP setup successful" className={styles.alert} />
            <p className={styles.subheading}>
              Authenticator assurance level: <strong>{assuranceResult?.currentLevel ?? 'unknown'}</strong>
              {assuranceResult?.nextLevel ? ` (next: ${assuranceResult.nextLevel})` : ''}
            </p>
            <p className={styles.subheading}>
              Supabase session still valid: <strong>{sessionStillValid ? 'yes' : 'no'}</strong>
            </p>
            <p className={styles.subheading}>
              This result is for testing only — it has not changed how admin access works. Your existing login
              still requires the current OTP step.
            </p>
          </>
        )}

        <p className={styles.hint}>
          <Link to="/admin/gallery">
            <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
            Return to admin area
          </Link>
        </p>
      </div>
    </div>
  );
};

export default MfaSetupPage;
