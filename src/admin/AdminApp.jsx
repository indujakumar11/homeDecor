import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import OtpPage from './pages/OtpPage';
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
