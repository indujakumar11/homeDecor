import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { requestPasswordReset } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

// ============================================================================
// FORGOT PASSWORD — request a recovery email (Supabase Auth's own
// resetPasswordForEmail(), no custom token/email logic — see authService.js)
// ============================================================================
// Deliberately never distinguishes "no such account," "not an admin," or
// "sent" in its own UI — the exact same generic message is shown for every
// outcome except a plain client-side input error (empty/malformed email,
// checked identically regardless of whether that email exists) or a true
// network failure. See requestPasswordReset()'s own comments for why.
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('form'); // 'form' | 'submitting' | 'sent'
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('submitting');

    const result = await requestPasswordReset(email);

    if (!result.success) {
      setError(result.message);
      setStatus('form');
      return;
    }

    setStatus('sent');
  };

  return (
    <div className={styles.authScreen}>
      <div className={styles.authCard}>
        <div className={styles.brandBlock}>
          <span className={styles.brandTitle}>BLACK SHADES</span>
          <span className={styles.brandSub}>ADMIN PORTAL</span>
        </div>

        <h1 className={styles.heading}>Reset your password</h1>

        {status === 'sent' ? (
          <>
            <InlineAlert
              type="success"
              message="If an account exists for this email address, a password reset link has been sent."
              className={styles.alert}
            />
            <p className={styles.subheading}>
              Check your inbox and follow the link to choose a new password. The link will bring you back
              here to finish resetting it.
            </p>
          </>
        ) : (
          <>
            <p className={styles.subheading}>
              Enter the email address for your admin account and we&apos;ll send you a link to reset your
              password.
            </p>

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

              <button type="submit" className={styles.submitBtn} disabled={status === 'submitting'}>
                <Mail size={16} />
                <span>{status === 'submitting' ? 'Sending…' : 'Send reset link'}</span>
              </button>
            </form>
          </>
        )}

        <p className={styles.hint}>
          <Link to="/admin/login">
            <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
