import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { hasValidOtpProof } from '../../services/authService';
import styles from './ProtectedRoute.module.scss';

// Guards admin pages behind BOTH a real Supabase Auth session AND a
// completed (Worker-verified) OTP step — Step 3C.1/3C.2. A session alone is
// not enough: signInWithPassword() succeeds before OTP even starts, so
// relying on session existence alone would let someone skip straight to
// /admin/gallery after just entering a password. The OTP-proof check here
// (including that the proof belongs to THIS session's user, not some other
// account's leftover proof) is a client-side convenience/UX gate only — the
// Worker independently re-validates the proof (and the Supabase token) on
// every privileged request, which is the real security boundary (see
// worker/src/index.ts, requireOtpVerifiedUser). No AAL/MFA level check —
// that's a later step.
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = useState('checking'); // 'checking' | 'authenticated' | 'no-session' | 'no-proof'

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setStatus('no-session');
        return;
      }
      setStatus(hasValidOtpProof(data.session.user.id) ? 'authenticated' : 'no-proof');
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === 'checking') {
    return (
      <div className={styles.checkingScreen}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>Checking session…</span>
      </div>
    );
  }

  if (status === 'no-session') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (status === 'no-proof') {
    return <Navigate to="/admin/otp" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
