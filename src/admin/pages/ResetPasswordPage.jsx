import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { updatePassword } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

// ============================================================================
// RESET PASSWORD — completes the Forgot Password flow
// ============================================================================
// Reached only via the recovery-link redirect: authService.js's
// `PASSWORD_RECOVERY` listener rewrites the URL hash to this route only
// AFTER Supabase has already parsed the recovery link's tokens and
// established the (aal1) recovery session — so by the time this component
// mounts, supabase.auth.getSession() already has it. If there's no
// session at all (expired link, already used, or just navigated here
// directly), that's treated as "invalid/expired," never as an error to
// bypass.
//
// On success this signs the user OUT and shows a "back to login" link
// rather than continuing into the dashboard — a recovery session is aal1
// by nature (no TOTP was ever involved in creating it), and this project's
// AAL2 model requires a real TOTP-verified session for admin access
// regardless of how recently a password was set. The normal flow after a
// reset remains: email + new password → TOTP → aal2 → dashboard.
const ResetPasswordPage = () => {
  // 'checking' | 'invalid-session' | 'form' | 'submitting' | 'success'
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? 'form' : 'invalid-session');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Enter a new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setStatus('submitting');
    const result = await updatePassword(password);

    if (!result.success) {
      setError(result.message);
      setStatus('form');
      return;
    }

    // Force a fresh, normal login (with TOTP) afterward rather than
    // leaving this aal1 recovery session active. A plain signOut() is
    // used directly here (not authService.js's logout()) — that helper
    // also revokes the legacy Worker OTP-proof record, which has no
    // relevance to a recovery session and would make this page's success
    // path needlessly depend on Worker availability.
    await supabase.auth.signOut();
    setStatus('success');
  };

  return (
    <div className={styles.authScreen}>
      <div className={styles.authCard}>
        <div className={styles.brandBlock}>
          <span className={styles.brandTitle}>BLACK SHADES</span>
          <span className={styles.brandSub}>ADMIN PORTAL</span>
        </div>

        {status === 'checking' ? null : status === 'invalid-session' ? (
          <>
            <h1 className={styles.heading}>Reset your password</h1>
            <InlineAlert
              type="error"
              message="This password reset link is invalid or has expired."
              className={styles.alert}
            />
            <p className={styles.subheading}>Request a new link to reset your password.</p>
            <p className={styles.hint}>
              <Link to="/admin/forgot-password">Request a new reset link</Link>
            </p>
          </>
        ) : status === 'success' ? (
          <>
            <h1 className={styles.heading}>Password updated</h1>
            <InlineAlert
              type="success"
              message="Your password has been changed successfully."
              className={styles.alert}
            />
            <p className={styles.subheading}>
              Sign in with your new password, then complete two-factor authentication as usual.
            </p>
            <p className={styles.hint}>
              <Link to="/admin/login">
                <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                Back to login
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Choose a new password</h1>
            <p className={styles.subheading}>Enter and confirm your new password below.</p>

            <InlineAlert type="error" message={error} className={styles.alert} />

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="new-password" className={styles.label}>New password</label>
                <div className={styles.passwordFieldWrapper}>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    className={`${styles.input} ${styles.passwordInput}`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.passwordToggleBtn}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="confirm-password" className={styles.label}>Confirm new password</label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={status === 'submitting'}>
                <KeyRound size={16} />
                <span>{status === 'submitting' ? 'Updating…' : 'Update password'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
