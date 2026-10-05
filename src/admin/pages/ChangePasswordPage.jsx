import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { changePassword } from '../../services/authService';
import AdminLayout from '../layouts/AdminLayout';
import InlineAlert from '../components/InlineAlert';
import styles from './ChangePasswordPage.module.scss';

// ============================================================================
// CHANGE PASSWORD — for an already-authenticated, aal2 admin
// ============================================================================
// Reached from SecuritySettingsPage.jsx, behind the same ProtectedRoute as
// every other admin page (enabled admin + aal2 required to even load this
// component at all). changePassword() (authService.js) re-verifies
// `currentPassword` against Supabase Auth itself before changing anything,
// using a throwaway client that cannot touch this page's real session —
// the admin's aal2 session here is never downgraded or signed out by this
// flow, because supabase.auth.updateUser({ password }) does not mint a new
// session (confirmed by reading auth-js's _updateUser(): it reuses the
// existing access/refresh token pair). TOTP factors are entirely untouched
// by anything on this page.
const ChangePasswordPage = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [status, setStatus] = useState('form'); // 'form' | 'submitting' | 'success'
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword) {
      setError('Enter your current password and a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setStatus('submitting');
    const result = await changePassword(currentPassword, newPassword);

    if (!result.success) {
      setError(result.message);
      setStatus('form');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStatus('success');
  };

  return (
    <AdminLayout fullBleed>
      <div className={styles.fullscreenWrap}>
        <div className={styles.inner}>
          <div className={styles.header}>
            <h1 className={styles.title}>Change password</h1>
            <p className={styles.subtitle}>Update the password for this admin account.</p>
          </div>

          <InlineAlert type="success" message={status === 'success' ? 'Password changed successfully.' : ''} className={styles.toast} />
          <InlineAlert type="error" message={error} className={styles.toast} />

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor="current-password" className={styles.label}>Current password</label>
              <input
                id="current-password"
                type={showPasswords ? 'text' : 'password'}
                className={styles.input}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="new-password" className={styles.label}>New password</label>
              <div className={styles.passwordFieldWrapper}>
                <input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  className={`${styles.input} ${styles.passwordInput}`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggleBtn}
                  onClick={() => setShowPasswords((prev) => !prev)}
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="confirm-new-password" className={styles.label}>Confirm new password</label>
              <input
                id="confirm-new-password"
                type={showPasswords ? 'text' : 'password'}
                className={styles.input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={status === 'submitting'}>
              <KeyRound size={16} />
              <span>{status === 'submitting' ? 'Changing…' : 'Change password'}</span>
            </button>
          </form>

          <p className={styles.hint}>
            <Link to="/admin/security">
              <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              Back to Security
            </Link>
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ChangePasswordPage;
