import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { loginWithPassword, isCurrentUserEnabledAdmin, getVerifiedTotpFactor } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password step only (no longer starts the old Worker OTP challenge here
  // — see authService.js's loginWithPassword()). Once signed in:
  //   1. Phase 6B — must be an ENABLED ADMIN (public.admin_users, via the
  //      existing isCurrentUserEnabledAdmin() RPC) before anything else is
  //      even considered. A non-admin sees a flat "not authorized" message
  //      — deliberately NOT a TOTP-setup prompt, so a confirmed non-admin
  //      is never even told the enrollment path exists. (MfaSetupPage.jsx
  //      independently re-checks this too — this is a UX improvement, not
  //      the only enforcement.)
  //   2. No verified TOTP factor yet → straight to /admin/mfa-setup
  //      (first-time client onboarding — see that page).
  //   3. Verified factor exists → /admin/mfa to enter the code.
  // Never enrolls a factor itself. The old /admin/otp flow
  // (authService.login()) is left completely intact and unused here.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await loginWithPassword(email, password);

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    const isAdmin = await isCurrentUserEnabledAdmin();
    if (!isAdmin) {
      setError('You are not authorized to access the admin area.');
      setIsSubmitting(false);
      return;
    }

    const verifiedFactor = await getVerifiedTotpFactor();
    if (!verifiedFactor) {
      navigate('/admin/mfa-setup');
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
            <div className={styles.labelRow}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <Link to="/admin/forgot-password" className={styles.inlineLink}>Forgot password?</Link>
            </div>
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
