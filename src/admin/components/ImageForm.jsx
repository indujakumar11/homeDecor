import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, AlertCircle } from 'lucide-react';
import { getCategories } from '../../services/galleryService';
import { uploadImage, deleteUploadedImage, deleteImageByUrl } from '../../services/uploadService';
import InlineAlert from './InlineAlert';
import styles from './ImageForm.module.scss';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — matches the local Worker's upload limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
  const [statusMessage, setStatusMessage] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((data) => { if (!cancelled) setCategories(data); })
      .catch(() => { if (!cancelled) setCategoriesError('Unable to load categories. Please refresh and try again.'); });
    return () => { cancelled = true; };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: 'Only JPG, PNG, and WEBP images are allowed.' }));
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, image: 'Image must be 5MB or smaller.' }));
      e.target.value = '';
      return;
    }

    setErrors((prev) => ({ ...prev, image: '' }));
    setSelectedFile(file);
    // Instant local preview only (a blob: URL, browser-tab-local). On submit
    // this file gets uploaded to the local Worker/R2 and previewUrl is
    // replaced with the real, persistent URL it returns — see handleSubmit.
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
    // Tracks a freshly-uploaded R2 object so it can be cleaned up if the
    // Supabase write below fails — see uploadService.deleteUploadedImage.
    // This is a best-effort safety net, not a real transaction: if the
    // cleanup call itself fails (e.g. the Worker goes down mid-request),
    // the image is left orphaned in local R2 and only the error below is
    // reported.
    let uploadResult = null;
    try {
      let imageUrl = previewUrl;
      if (selectedFile) {
        setStatusMessage('Uploading image…');
        uploadResult = await uploadImage(selectedFile);
        imageUrl = uploadResult.imageUrl;
      }

      setStatusMessage(mode === 'edit' ? 'Saving changes…' : 'Saving decor…');
      await onSubmit({
        categoryId,
        title: title.trim(),
        description: description.trim(),
        imageUrl,
      });

      // Supabase now points at the new image — only NOW is it safe to
      // remove the old one. This ordering matters: if the save above had
      // failed, we must not have touched the old image at all (see the
      // catch block, which instead cleans up the NEW upload). This is
      // best-effort and non-blocking of the already-successful save: R2 and
      // Supabase are separate systems with no shared transaction, so a
      // failure here does not get rolled back or re-reported as an error —
      // it's logged (see uploadService), and the edit the admin asked for
      // has already genuinely succeeded.
      if (mode === 'edit' && selectedFile && initialData?.imageUrl) {
        await deleteImageByUrl(initialData.imageUrl);
      }
    } catch (err) {
      if (uploadResult) {
        await deleteUploadedImage(uploadResult.deleteUrl);
        setFormError('The image uploaded, but saving the decor failed, so the image was removed. Please try again.');
      } else {
        setFormError(err?.message || 'Something went wrong while saving. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
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
          disabled={categories.length === 0}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setErrors((prev) => ({ ...prev, category: '' }));
          }}
        >
          <option value="">{categories.length === 0 ? 'Loading categories…' : 'Select a category'}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {errors.category && <span className={styles.errorText}><AlertCircle size={13} />{errors.category}</span>}
        {categoriesError && <span className={styles.errorText}><AlertCircle size={13} />{categoriesError}</span>}
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
            <span className={styles.dropzoneHint}>JPG, PNG or WEBP — up to 5MB</span>
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
          {isSubmitting ? (statusMessage || 'Saving…') : (submitLabel || (mode === 'edit' ? 'Save Changes' : 'Add Decor'))}
        </button>
      </div>
    </form>
  );
};

export default ImageForm;
