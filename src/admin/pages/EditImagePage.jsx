import React, { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { getImageById, updateImage } from '../../services/galleryService';
import ImageFormScreen from '../components/ImageFormScreen';

const EditImagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');
  const image = getImageById(id);

  // Unknown/deleted id (e.g. stale link, direct URL edit) — back to the gallery.
  if (!image) {
    return <Navigate to="/admin/gallery" replace />;
  }

  const handleSubmit = async (data) => {
    updateImage(id, data);
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
