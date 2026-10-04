import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { hasValidOtpProof, isCurrentUserEnabledAdmin, getVerifiedTotpFactor, logout } from '../../services/authService';
import styles from './ProtectedRoute.module.scss';

// Guards admin pages behind, in order:
//   1. a real Supabase Auth session
//   2. the authenticated user being an ENABLED ADMIN (public.admin_users,
//      checked via the existing SECURITY DEFINER public.is_enabled_admin()
//      RPC — see authService.js's isCurrentUserEnabledAdmin(). Phase 6B:
//      previously this check didn't exist here at all, which meant any
//      authenticated Supabase account (signup is open) that reached aal2
//      via its own TOTP enrollment could pass this guard and load the
//      admin UI shell, even though it could never perform any privileged
//      write (Worker/RLS independently require admin_users.enabled too).
//      This step closes that UI-shell-access gap.)
//   3. a completed second factor — the existing Worker-verified OTP proof
//      (unchanged, additive, still checked first so the old flow keeps
//      working exactly as before), OR Supabase's own native aal2 reached
//      via an already-VERIFIED TOTP factor.
// A session alone is not enough, and (as of Phase 6B) neither is a session
// + aal2 alone — admin_users.enabled is mandatory. None of these checks are
// the real security boundary on their own: the Worker independently
// re-validates the OTP proof (or the verified JWT's aal2 claim) and
// admin_users on every privileged request (see worker/src/index.ts,
// requireOtpVerifiedUser / authorizeAdminRequest), and RLS independently
// re-checks aal2 + is_enabled_admin() (or the old otp_verified claim) on
// every direct database write (see supabase/migrations/008_aal2_decor_
// items_authorization.sql). This component only controls which route a
// user lands on — it cannot grant or withhold any actual data access.
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // 'checking' | 'authenticated' | 'no-session' | 'not-admin' | 'no-totp' | 'needs-mfa-verify'
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setStatus('no-session');
        return;
      }

      // Phase 6B: checked immediately after confirming a session exists,
      // before anything else — an authenticated-but-not-enabled-admin
      // account is blocked here regardless of OTP proof / TOTP / aal2
      // state, closing the gap described above.
      const isAdmin = await isCurrentUserEnabledAdmin();
      if (cancelled) return;
      if (!isAdmin) {
        setStatus('not-admin');
        return;
      }

      // Existing Worker-verified OTP proof — unchanged, still accepted on
      // its own for an enabled admin, exactly as before Phase 6B.
      if (hasValidOtpProof(data.session.user.id)) {
        setStatus('authenticated');
        return;
      }

      // Distinguish "no verified TOTP factor at all yet" (→ setup) from
      // "has one, just hasn't completed it this session" (→ verify) —
      // previously collapsed into a single aal2 check that couldn't tell
      // these apart.
      const verifiedFactor = await getVerifiedTotpFactor();
      if (cancelled) return;
      if (!verifiedFactor) {
        setStatus('no-totp');
        return;
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!cancelled) {
        setStatus(aalData?.currentLevel === 'aal2' ? 'authenticated' : 'needs-mfa-verify');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const handleSignOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

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

  if (status === 'not-admin') {
    return (
      <div className={styles.checkingScreen}>
        <p className={styles.unauthorizedMessage}>You are not authorized to access the admin area.</p>
        <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  if (status === 'no-totp') {
    return <Navigate to="/admin/mfa-setup" state={{ from: location }} replace />;
  }

  if (status === 'needs-mfa-verify') {
    return <Navigate to="/admin/mfa" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
