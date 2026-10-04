import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { hasValidOtpProof } from '../../services/authService';
import styles from './ProtectedRoute.module.scss';

// Guards admin pages behind a real Supabase Auth session AND a completed
// second factor — Step 3C.1/3C.2's Worker-verified OTP proof, OR (Phase 3 of
// the TOTP migration, additive, not a replacement) Supabase's own native
// aal2. A session alone is not enough: signInWithPassword() succeeds before
// either second factor starts, so relying on session existence alone would
// let someone skip straight to /admin/gallery after just entering a
// password. Both checks are client-side convenience/UX gates only — the
// Worker independently re-validates the OTP proof (and the Supabase token)
// on every privileged request, which is the real security boundary today
// (see worker/src/index.ts, requireOtpVerifiedUser). Server-side AAL2
// enforcement (RLS + Worker) is a later phase — this frontend check does
// not yet change what the Worker/RLS accept, only which login path a user
// can use to reach the admin UI at all.
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = useState('checking'); // 'checking' | 'authenticated' | 'no-session' | 'no-proof'

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setStatus('no-session');
        return;
      }

      if (hasValidOtpProof(data.session.user.id)) {
        setStatus('authenticated');
        return;
      }

      // Phase 3 — TOTP migration: additionally accept a session that has
      // reached Supabase's own native aal2, alongside the existing
      // OTP-proof check above. Purely additive — an aal1-only session
      // (password done, TOTP not yet verified) still falls through to
      // 'no-proof' exactly as before; nothing here weakens the existing
      // check.
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!cancelled) {
        setStatus(aalData?.currentLevel === 'aal2' ? 'authenticated' : 'no-proof');
      }
    })();

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
    // Phase 3 — the new login flow's second-factor step lives at
    // /admin/mfa now. The old /admin/otp route itself is untouched and
    // still independently reachable (e.g. direct navigation), but nothing
    // routes users there anymore as part of reaching the admin UI.
    return <Navigate to="/admin/mfa" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
