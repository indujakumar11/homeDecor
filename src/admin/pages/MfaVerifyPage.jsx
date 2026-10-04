import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getVerifiedTotpFactor,
  createTotpChallenge,
  verifyTotpChallenge,
} from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

// ============================================================================
// PHASE 3 — Supabase native TOTP MFA verification (new login flow)
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
const MfaVerifyPage = () => {
  const navigate = useNavigate();
  // 'checking' | 'no-session' | 'no-verified-factor' | 'ready' | 'verifying'
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const factorIdRef = useRef(null);
  const challengeIdRef = useRef(null);

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

      const verifiedFactor = await getVerifiedTotpFactor();
      if (cancelled) return;
      if (!verifiedFactor) {
        setStatus('no-verified-factor');
        return;
      }
      factorIdRef.current = verifiedFactor.id;

      // A fresh challenge every time this page loads/reloads — challenges
      // are short-lived and not persisted anywhere on our side, so a
      // refresh correctly starts a new one rather than relying on
      // component state that no longer exists.
      const challengeResult = await createTotpChallenge(verifiedFactor.id);
      if (cancelled) return;
      if (!challengeResult.success) {
        setError(challengeResult.message);
        setStatus('error');
        return;
      }
      challengeIdRef.current = challengeResult.challengeId;
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
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

        {status === 'checking' ? null : status === 'no-verified-factor' ? (
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
        ) : status === 'error' ? (
          <>
            <h1 className={styles.heading}>Two-factor authentication</h1>
            <InlineAlert type="error" message={error} className={styles.alert} />
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Two-factor authentication</h1>
            <p className={styles.subheading}>Enter the 6-digit code from Google Authenticator.</p>

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
