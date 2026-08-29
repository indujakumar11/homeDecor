import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getImageById, updateImage } from '../../services/galleryService';
import ImageFormScreen from '../components/ImageFormScreen';
import AdminLayout from '../layouts/AdminLayout';
import styles from './EditImagePage.module.scss';

const EditImagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');
  const [status, setStatus] = useState('loading'); // 'loading' | 'found' | 'not-found' | 'error'
  const [image, setImage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getImageById(id)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setImage(result);
          setStatus('found');
        } else {
          setStatus('not-found');
        }
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [id]);

  // Unknown/deleted id (e.g. stale link, direct URL edit) — back to the gallery.
  if (status === 'not-found') {
    return <Navigate to="/admin/gallery" replace />;
  }

  if (status === 'loading') {
    return (
      <AdminLayout fullBleed>
        <div className={styles.centeredState}>
          <Loader2 size={32} className={styles.spinIcon} />
          <p>Loading decor…</p>
        </div>
      </AdminLayout>
    );
  }

  if (status === 'error') {
    return (
      <AdminLayout fullBleed>
        <div className={styles.centeredState}>
          <p>Unable to load decor. Please try again.</p>
          <button type="button" className={styles.retryBtn} onClick={() => navigate(0)}>Retry</button>
        </div>
      </AdminLayout>
    );
  }

  const handleSubmit = async (data) => {
    await updateImage(id, data);
    setSuccessMessage('Image updated successfully.');
    setTimeout(() => navigate('/admin/gallery'), 900);
  };

  return (
    <ImageFormScreen
      heading="Edit Image"
      subtitle="Update the category, title, description, or image, then save your changes."
      mode="edit"
      initialData={image}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/admin/gallery')}
      successMessage={successMessage}
    />
  );
};

export default EditImagePage;
