import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { loginWithPassword, getVerifiedTotpFactor } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [needsMfaSetup, setNeedsMfaSetup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phase 3 — TOTP migration: password step only (no longer starts the old
  // Worker OTP challenge here — see authService.js's loginWithPassword()).
  // Once signed in, this checks for an already-enrolled, VERIFIED TOTP
  // factor (an unverified/pending one is never treated as sufficient) and
  // routes to the new /admin/mfa page. It deliberately never enrolls a
  // factor itself — an account with no verified factor is told to set one
  // up (via the existing /admin/mfa-setup page) rather than being silently
  // let through. The old /admin/otp flow (authService.login()) is left
  // completely intact and unused by this handler, per this phase's scope.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNeedsMfaSetup(false);
    setIsSubmitting(true);

    const result = await loginWithPassword(email, password);

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    const verifiedFactor = await getVerifiedTotpFactor();
    if (!verifiedFactor) {
      setError('This admin account does not have an authenticator app (TOTP) enrolled yet.');
      setNeedsMfaSetup(true);
      setIsSubmitting(false);
      return;
    }

    navigate('/admin/mfa');
  };

  return (
    <div className={styles.authScreen}>
      <div className={styles.authCard}>
        <div className={styles.brandBlock}>
          <span className={styles.brandTitle}>BLACK SHADES</span>
          <span className={styles.brandSub}>ADMIN PORTAL</span>
        </div>

        <h1 className={styles.heading}>Sign in</h1>
        <p className={styles.subheading}>Enter your credentials to access the admin panel.</p>

        <InlineAlert type="error" message={error} className={styles.alert} />
        {needsMfaSetup && (
          <p className={styles.hint}>
            <Link to="/admin/mfa-setup">Set up authenticator app</Link>
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <div className={styles.passwordFieldWrapper}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.input} ${styles.passwordInput}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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

          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            <LogIn size={16} />
            <span>{isSubmitting ? 'Signing in…' : 'Continue'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
