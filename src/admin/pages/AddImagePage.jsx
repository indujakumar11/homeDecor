import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addImage } from '../../services/galleryService';
import ImageFormScreen from '../components/ImageFormScreen';

const AddImagePage = () => {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');

  // Errors from addImage() propagate up through ImageForm's own onSubmit
  // try/catch (it already shows a form-level InlineAlert on failure), so
  // this handler only needs to handle the success path.
  const handleSubmit = async (data) => {
    await addImage(data);
    setSuccessMessage('Decor added successfully.');
    setTimeout(() => navigate('/admin/gallery'), 900);
  };

  return (
    <ImageFormScreen
      heading="Add New Decor"
      subtitle="Add a decor item to the public gallery — pick a category, add a title and description, then upload the image."
      mode="add"
      onSubmit={handleSubmit}
      onCancel={() => navigate('/admin/gallery')}
      successMessage={successMessage}
    />
  );
};

export default AddImagePage;
