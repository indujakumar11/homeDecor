import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { verifyOtp, hasPendingOtp, isAuthenticated } from '../../services/authService';
import InlineAlert from '../components/InlineAlert';
import styles from './AuthPages.module.scss';

const OtpPage = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to="/admin/gallery" replace />;
  }

  // No login in progress (e.g. direct URL visit) — send back to step 1.
  if (!hasPendingOtp()) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = verifyOtp(otp);

    if (result.success) {
      navigate('/admin/gallery', { replace: true });
    } else {
      setError(result.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className={styles.authScreen}>
      <div className={styles.authCard}>
        <div className={styles.brandBlock}>
          <span className={styles.brandTitle}>BLACK SHADES</span>
          <span className={styles.brandSub}>ADMIN PORTAL</span>
        </div>

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
            <span>Verify & Continue</span>
          </button>
        </form>

        <p className={styles.hint}>Demo OTP: <strong>123456</strong></p>
      </div>
    </div>
  );
};

export default OtpPage;
