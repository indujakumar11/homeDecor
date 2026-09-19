import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
// DEV-ONLY OTP step (see authService.js + worker/src/index.ts) — Step 3C.1
// replaced the hardcoded mock with a real Worker-verified challenge; Step
// 3C's later stage replaces the Worker's dev OTP generation with Twilio
// Verify without changing this page's flow.
import { verifyOtp, hasPendingOtp } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

const OtpPage = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'no-session'

  useEffect(() => {
    let cancelled = false;
    hasPendingOtp().then((pending) => {
      if (!cancelled) setStatus(pending ? 'ready' : 'no-session');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // No Supabase session at all (e.g. direct URL visit, or it expired) —
  // send back to step 1. There is nothing to verify without an
  // authenticated user for the Worker to identify.
  if (status === 'no-session') {
    return <Navigate to="/admin/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await verifyOtp(otp);

    if (result.success) {
      navigate('/admin/gallery', { replace: true });
    } else {
      setError(result.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.authScreen}>
      <div className={styles.authCard}>
        <div className={styles.brandBlock}>
          <span className={styles.brandTitle}>BLACK SHADES</span>
          <span className={styles.brandSub}>ADMIN PORTAL</span>
        </div>

        {status === 'checking' ? null : (
          <>
            <h1 className={styles.heading}>Verify OTP</h1>
            <p className={styles.subheading}>Enter the 6-digit code sent to your registered number.</p>

            <InlineAlert type="error" message={error} className={styles.alert} />

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="otp" className={styles.label}>One-Time Password</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={`${styles.input} ${styles.otpInput}`}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                <ShieldCheck size={16} />
                <span>{isSubmitting ? 'Verifying…' : 'Verify & Continue'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default OtpPage;
