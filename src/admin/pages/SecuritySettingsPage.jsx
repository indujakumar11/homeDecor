import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, ShieldPlus, Trash2, KeyRound } from 'lucide-react';
import { listTotpFactors, unenrollTotpFactor } from '../../services/authService';
import AdminLayout from '../layouts/AdminLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import InlineAlert from '../components/InlineAlert';
import styles from './SecuritySettingsPage.module.scss';

const FRIENDLY_FALLBACK = 'Authenticator';

// ============================================================================
// BACKUP TOTP AUTHENTICATOR — factor management (Security settings)
// ============================================================================
// Lets an enabled admin see every TOTP factor on their own account (primary
// + any backups, verified or still-pending), add a new one (routes to
// MfaSetupPage.jsx's `?mode=add`), and remove one — reusing this project's
// existing AdminLayout/ConfirmDialog/InlineAlert exactly as GalleryManagement
// does. Factor state is always re-fetched from Supabase (listTotpFactors())
// on load and after every change — nothing about a factor (id, friendly
// name, verified status, dates) is ever cached in localStorage/sessionStorage.
//
// The "can't remove your last verified factor" rule is enforced by
// authService.js's unenrollTotpFactor() itself (re-checking the CURRENT
// server-side factor list immediately before calling unenroll()) — this
// page's disabled-button/explanatory-text treatment below is a UX
// convenience built on top of that, not a substitute for it.
const SecuritySettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [factors, setFactors] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const loadFactors = useCallback(async () => {
    setStatus('loading');
    try {
      setFactors(await listTotpFactors());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  // Returning here from MfaSetupPage.jsx's `?mode=add` (via its own
  // navigate(..., { state: { justAdded: true } })) — router state, not
  // storage, and only ever used to show a one-time success message; the
  // factor list itself always comes fresh from loadFactors() above,
  // regardless of this.
  useEffect(() => {
    if (location.state?.justAdded) {
      setSuccessMessage('Authenticator added successfully.');
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const verifiedCount = factors.filter((f) => f.status === 'verified').length;

  const handleConfirmRemove = async () => {
    const factor = pendingRemoval;
    if (!factor) return;

    setActionError('');
    setRemovingId(factor.id);
    const result = await unenrollTotpFactor(factor.id);
    setRemovingId(null);
    setPendingRemoval(null);

    if (!result.success) {
      setActionError(result.message);
      // Supabase's own state is authoritative — re-sync in case something
      // changed (e.g. another tab) between this page's load and this click.
      await loadFactors();
      return;
    }

    setSuccessMessage('Authenticator removed.');
    await loadFactors();
  };

  return (
    <AdminLayout fullBleed>
      <div className={styles.fullscreenWrap}>
        <div className={styles.inner}>
          <div className={styles.header}>
            <h1 className={styles.title}>Security</h1>
            <p className={styles.subtitle}>
              Manage the authenticator apps that can sign in to this admin account.
            </p>
          </div>

          <InlineAlert type="success" message={successMessage} className={styles.toast} />
          <InlineAlert type="error" message={actionError} className={styles.toast} />

          {status === 'loading' && (
            <div className={styles.centeredState}>
              <Loader2 size={28} className={styles.spinIcon} />
              <p>Loading authenticators…</p>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.centeredState}>
              <p>Unable to load authenticators. Please try again.</p>
              <button type="button" className={styles.retryBtn} onClick={loadFactors}>Retry</button>
            </div>
          )}

          {status === 'ready' && (
            <>
              <section className={styles.sectionLabel} aria-hidden="true">Authenticator factors</section>

              <ul className={styles.factorList} aria-label="Authenticator factors">
                {factors.length === 0 && (
                  <li className={styles.emptyState}>No authenticator app is enrolled yet.</li>
                )}

                {factors.map((factor) => {
                  const isVerified = factor.status === 'verified';
                  const isOnlyVerified = isVerified && verifiedCount <= 1;
                  const isRemoving = removingId === factor.id;
                  const label = factor.friendly_name || FRIENDLY_FALLBACK;

                  return (
                    <li key={factor.id} className={styles.factorCard}>
                      <div className={styles.factorInfo}>
                        <ShieldCheck
                          size={18}
                          className={isVerified ? styles.verifiedIcon : styles.unverifiedIcon}
                          aria-hidden="true"
                        />
                        <div>
                          <p className={styles.factorName}>{label}</p>
                          <p className={isVerified ? styles.statusVerified : styles.statusUnverified}>
                            {isVerified ? 'Verified' : 'Setup incomplete'}
                          </p>
                          {factor.created_at && (
                            <p className={styles.metaDate}>
                              Added: {new Date(factor.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className={styles.factorActions}>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          disabled={isOnlyVerified || isRemoving}
                          onClick={() => setPendingRemoval(factor)}
                        >
                          <Trash2 size={14} />
                          <span>{isRemoving ? 'Removing…' : 'Remove'}</span>
                        </button>
                        {isOnlyVerified && (
                          <p className={styles.lastFactorNote}>
                            This is your only verified authenticator. Add another authenticator before removing
                            this one.
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                className={styles.addBtn}
                onClick={() => navigate('/admin/mfa-setup?mode=add')}
              >
                <ShieldPlus size={16} />
                <span>Add authenticator</span>
              </button>

              <section className={styles.passwordSection}>
                <p className={styles.sectionLabel} aria-hidden="true">Password</p>
                <p className={styles.passwordHint}>Change your account password.</p>
                <button
                  type="button"
                  className={styles.changePasswordBtn}
                  onClick={() => navigate('/admin/change-password')}
                >
                  <KeyRound size={16} />
                  <span>Change password</span>
                </button>
              </section>
            </>
          )}

          <ConfirmDialog
            isOpen={Boolean(pendingRemoval)}
            title="Remove this authenticator?"
            message="You will no longer be able to use this authenticator to sign in. Make sure another verified authenticator remains available."
            confirmLabel="Remove"
            cancelLabel="Cancel"
            danger
            onConfirm={handleConfirmRemove}
            onCancel={() => setPendingRemoval(null)}
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default SecuritySettingsPage;
