import React, { useState, useRef } from 'react';
import { UploadCloud, X, AlertCircle } from 'lucide-react';
import { categories } from '../../data/categories';
import InlineAlert from './InlineAlert';
import styles from './ImageForm.module.scss';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — generous for a localStorage-backed prototype
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Shared Add/Edit image form.
 * mode: 'add' | 'edit'
 * initialData (edit mode): { categoryId, title, description, imageUrl }
 * onSubmit receives { categoryId, title, description, imageUrl } and may return a Promise.
 */
const ImageForm = ({ mode = 'add', initialData = null, onSubmit, onCancel, submitLabel }) => {
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [previewUrl, setPreviewUrl] = useState(initialData?.imageUrl || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: 'Only JPG, PNG, and WEBP images are allowed.' }));
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, image: 'Image must be 2MB or smaller.' }));
      e.target.value = '';
      return;
    }

    setErrors((prev) => ({ ...prev, image: '' }));
    setSelectedFile(file);
    // Instant preview — for the final saved value this gets converted to a
    // data URL on submit so it survives a page reload (see readFileAsDataUrl).
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = () => {
    const next = {};
    if (!categoryId) next.category = 'Please select a category.';
    if (!title.trim()) next.title = 'Title is required.';
    if (!previewUrl) next.image = 'Please select an image.';
    setErrors((prev) => ({ ...prev, ...next, category: next.category || '', title: next.title || '' }));
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const imageUrl = selectedFile ? await readFileAsDataUrl(selectedFile) : previewUrl;
      await onSubmit({
        categoryId,
        title: title.trim(),
        description: description.trim(),
        imageUrl,
      });
    } catch {
      setFormError('Something went wrong while saving. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <InlineAlert type="error" message={formError} className={styles.formAlert} />

      <div className={styles.field}>
        <label htmlFor="image-category" className={styles.label}>
          Category <span className={styles.required}>*</span>
        </label>
        <select
          id="image-category"
          className={`${styles.select} ${errors.category ? styles.inputError : ''}`}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setErrors((prev) => ({ ...prev, category: '' }));
          }}
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {errors.category && <span className={styles.errorText}><AlertCircle size={13} />{errors.category}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="image-title" className={styles.label}>
          Title <span className={styles.required}>*</span>
        </label>
        <input
          id="image-title"
          type="text"
          className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((prev) => ({ ...prev, title: '' }));
          }}
          placeholder="e.g. Luxury Mural Design"
        />
        {errors.title && <span className={styles.errorText}><AlertCircle size={13} />{errors.title}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="image-description" className={styles.label}>Description</label>
        <textarea
          id="image-description"
          className={styles.textarea}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description of this image"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Image <span className={styles.required}>*</span>
        </label>

        {previewUrl ? (
          <div className={styles.previewWrap}>
            <img src={previewUrl} alt="Preview" className={styles.previewImg} />
            <button type="button" className={styles.removeImgBtn} onClick={clearImage} aria-label="Remove image">
              <X size={15} />
            </button>
          </div>
        ) : (
          <label htmlFor="image-file" className={`${styles.dropzone} ${errors.image ? styles.inputError : ''}`}>
            <UploadCloud size={26} />
            <span>Click to upload an image</span>
            <span className={styles.dropzoneHint}>JPG, PNG or WEBP — up to 2MB</span>
          </label>
        )}
        <input
          ref={fileInputRef}
          id="image-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className={styles.fileInput}
        />
        {previewUrl && (
          <button type="button" className={styles.changeImgBtn} onClick={() => fileInputRef.current?.click()}>
            Change image
          </button>
        )}
        {errors.image && <span className={styles.errorText}><AlertCircle size={13} />{errors.image}</span>}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : (submitLabel || (mode === 'edit' ? 'Save Changes' : 'Add Decor'))}
        </button>
      </div>
    </form>
  );
};

export default ImageForm;
