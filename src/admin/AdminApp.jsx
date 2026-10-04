import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import OtpPage from './pages/OtpPage';
// TEMPORARY — Phase 2 of the Supabase TOTP MFA migration audit. Self-
// contained enrollment/testing page; does not touch the existing OTP flow
// or ProtectedRoute. Safe to remove along with its one route below once
// this phase of testing is done. See MfaSetupPage.jsx's own header comment.
import MfaSetupPage from './pages/MfaSetupPage';
// Phase 3 — new TOTP verification step for the normal login flow. See its
// own header comment; the old /admin/otp route below remains untouched.
import MfaVerifyPage from './pages/MfaVerifyPage';
import GalleryManagementPage from './pages/GalleryManagementPage';
import AddImagePage from './pages/AddImagePage';
import EditImagePage from './pages/EditImagePage';
import './styles/_admin-variables.scss';

// Route subtree for everything under /admin. Kept separate from the public
// site's routes/layout in App.jsx — the admin portal has its own chrome
// (a Sidebar) and none of the public site's Lenis/GSAP/WhatsApp widgets.
const AdminApp = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="/admin/gallery" replace />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="otp" element={<OtpPage />} />
      {/* TEMPORARY — Phase 2 MFA audit only, see MfaSetupPage.jsx */}
      <Route path="mfa-setup" element={<MfaSetupPage />} />
      {/* Phase 3 — new TOTP verification step, see MfaVerifyPage.jsx */}
      <Route path="mfa" element={<MfaVerifyPage />} />
      <Route
        path="gallery"
        element={(
          <ProtectedRoute>
            <GalleryManagementPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="gallery/add"
        element={(
          <ProtectedRoute>
            <AddImagePage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="gallery/edit/:id"
        element={(
          <ProtectedRoute>
            <EditImagePage />
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to="/admin/gallery" replace />} />
    </Routes>
  );
};

export default AdminApp;
