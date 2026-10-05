import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getVerifiedTotpFactors,
  createTotpChallenge,
  verifyTotpChallenge,
} from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

// ============================================================================
// PHASE 3 — Supabase native TOTP MFA verification (new login flow)
// BACKUP TOTP phase — extended to support more than one verified factor.
// ============================================================================
// Verifies an ALREADY-ENROLLED TOTP factor (see MfaSetupPage.jsx for
// enrollment, untouched by this phase — this page never calls
// supabase.auth.mfa.enroll()). This is the new step 2 of login, reached
// only from LoginPage.jsx after a password sign-in finds a verified TOTP
// factor on the account.
//
// The old /admin/otp (Twilio/mock OTP) page and Worker routes remain fully
// intact and untouched — this page is a separate, parallel path, not a
// replacement of that code.
//
// Source of truth is exclusively Supabase's own session + AAL state
// (supabase.auth.getSession() / supabase.auth.mfa.getAuthenticatorAssuranceLevel()).
// Nothing here is written to localStorage/sessionStorage.
//
// With exactly one verified factor, behavior is byte-for-byte the same as
// before this phase: it's challenged immediately, no picker is ever shown.
// With more than one, a factor-choice screen is inserted before the
// challenge starts — selection is always by factor.id, never array
// position, and only VERIFIED factors (from getVerifiedTotpFactors()) are
// ever offered here.
const MfaVerifyPage = () => {
  const navigate = useNavigate();
  // 'checking' | 'no-session' | 'no-verified-factor' | 'choosing-factor' |
  // 'starting-challenge' | 'ready' | 'verifying' | 'error'
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [factorChoices, setFactorChoices] = useState([]);
  const [selectedFactor, setSelectedFactor] = useState(null);
  const factorIdRef = useRef(null);
  const challengeIdRef = useRef(null);
  // Shared by the mount effect below (which can legitimately unmount mid-
  // flight, e.g. a fast navigation away) and the factor-picker's click
  // handler (where the component is, by definition, still mounted) — lets
  // the one startChallenge() implementation stay unmount-safe for both.
  // Must reset to false on (re)mount, not just flip true on cleanup:
  // React.StrictMode (enabled in main.jsx) mounts, cleans up, and remounts
  // every component once in development specifically to surface this exact
  // bug — without the reset, that synthetic cleanup would permanently wedge
  // this ref at `true`, so startChallenge() would bail out after its first
  // await forever and the page would stay blank with no code input.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  const startChallenge = async (factor) => {
    setError('');
    setSelectedFactor(factor);
    factorIdRef.current = factor.id;
    setStatus('starting-challenge');

    // A fresh challenge every time one starts — challenges are short-lived
    // and not persisted anywhere on our side, so re-entering this step
    // (page refresh, or picking a factor) correctly starts a new one
    // rather than relying on component state that no longer exists.
    const challengeResult = await createTotpChallenge(factor.id);
    if (unmountedRef.current) return;
    if (!challengeResult.success) {
      setError(challengeResult.message);
      setStatus('error');
      return;
    }
    challengeIdRef.current = challengeResult.challengeId;
    setStatus('ready');
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Real Supabase session check — never a localStorage/sessionStorage
      // flag. A page refresh re-runs this from scratch (React state does
      // not need to survive a refresh — the session does, via Supabase's
      // own persistence).
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sessionData.session) {
        setStatus('no-session');
        return;
      }

      const verifiedFactors = await getVerifiedTotpFactors();
      if (cancelled) return;
      if (verifiedFactors.length === 0) {
        setStatus('no-verified-factor');
        return;
      }

      if (verifiedFactors.length > 1) {
        // More than one verified factor — let the user choose rather than
        // silently picking one by array position. No challenge is started
        // until that choice is made.
        setFactorChoices(verifiedFactors);
        setStatus('choosing-factor');
        return;
      }

      // Exactly one verified factor — unchanged from the original
      // single-factor experience.
      if (cancelled) return;
      await startChallenge(verifiedFactors[0]);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'no-session') {
    return <Navigate to="/admin/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code exactly as shown in your authenticator app.');
      return;
    }

    setStatus('verifying');
    const result = await verifyTotpChallenge(factorIdRef.current, challengeIdRef.current, code);

    if (result.success) {
      navigate('/admin/gallery', { replace: true });
      return;
    }

    // Stay on this page, allow retry — do not navigate to admin.
    setError(result.message);
    setCode('');
    setStatus('ready');
  };

  return (
    <div className={styles.authScreen}>
      <div className={styles.authCard}>
        <div className={styles.brandBlock}>
          <span className={styles.brandTitle}>BLACK SHADES</span>
          <span className={styles.brandSub}>ADMIN PORTAL</span>
        </div>

        {status === 'checking' || status === 'starting-challenge' ? null : status === 'no-verified-factor' ? (
          <>
            <h1 className={styles.heading}>Two-factor authentication</h1>
            <InlineAlert
              type="error"
              message="No verified authenticator app is enrolled for this account."
              className={styles.alert}
            />
            <p className={styles.hint}>
              <Link to="/admin/mfa-setup">Set up authenticator app</Link>
            </p>
          </>
        ) : status === 'choosing-factor' ? (
          <>
            <h1 className={styles.heading}>Two-factor authentication</h1>
            <p className={styles.subheading}>Choose an authenticator to continue.</p>

            <InlineAlert type="error" message={error} className={styles.alert} />

            <div className={styles.factorChoiceList}>
              {factorChoices.map((factor) => (
                <button
                  key={factor.id}
                  type="button"
                  className={styles.factorChoiceBtn}
                  onClick={() => startChallenge(factor)}
                >
                  {factor.friendly_name || 'Authenticator'}
                </button>
              ))}
            </div>

            <p className={styles.hint}>
              <Link to="/admin/login">Back to login</Link>
            </p>
          </>
        ) : status === 'error' ? (
          <>
            <h1 className={styles.heading}>Two-factor authentication</h1>
            <InlineAlert type="error" message={error} className={styles.alert} />
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Two-factor authentication</h1>
            <p className={styles.subheading}>
              {factorChoices.length > 1 && selectedFactor?.friendly_name
                ? `Enter the 6-digit code from ${selectedFactor.friendly_name}.`
                : 'Enter the 6-digit code from Google Authenticator.'}
            </p>

            <InlineAlert type="error" message={error} className={styles.alert} />

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="totp-code" className={styles.label}>Authentication code</label>
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
                  autoFocus
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={status === 'verifying'}>
                <ShieldCheck size={16} />
                <span>{status === 'verifying' ? 'Verifying…' : 'Verify'}</span>
              </button>
            </form>

            <p className={styles.hint}>
              <Link to="/admin/login">Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default MfaVerifyPage;
