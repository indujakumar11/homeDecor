import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, AlertCircle } from 'lucide-react';
import { getCategories } from '../../services/galleryService';
import { uploadImage, deleteUploadedImage, deleteImageByUrl } from '../../services/uploadService';
import InlineAlert from './InlineAlert';
import styles from './ImageForm.module.scss';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — matches the local Worker's upload limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Phase 1 gallery-image-optimization — matches worker/src/index.ts's
// MAX_GALLERY_FILE_SIZE expectations and the approved architecture exactly:
// scale-to-fit to this long edge, never upscale, re-encode to WebP at this
// quality. Kept local to this component since it's the only place that
// generates a gallery variant (see createGalleryVariant below).
const GALLERY_MAX_LONG_EDGE = 1000;
const GALLERY_QUALITY = 0.82;

/**
 * Generates the optimized "gallery card" variant of a just-selected original
 * File, entirely client-side via the browser's native Canvas API — no image
 * processing dependency. Preserves aspect ratio, never upscales an already-
 * small image, and never paints a background fill (so transparency in a
 * source PNG/WebP survives into the output WebP, where the codec supports
 * alpha). Returns null (never throws) if generation fails for any reason —
 * callers must treat that identically to "no gallery variant available",
 * exactly like the Worker's own optional-galleryFile contract.
 */
async function createGalleryVariant(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null; // decode failed — original upload still proceeds unaffected
  }

  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > GALLERY_MAX_LONG_EDGE ? GALLERY_MAX_LONG_EDGE / longEdge : 1; // never upscale
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // No fillRect/background paint here — preserves transparency.
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/webp', GALLERY_QUALITY);
    });
    return blob; // Blob on success; toBlob resolves null if WebP encoding isn't supported
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

/**
 * Shared Add/Edit image form.
 * mode: 'add' | 'edit'
 * initialData (edit mode): { categoryId, title, description, imageUrl, galleryImageUrl }
 * onSubmit receives { categoryId, title, description, imageUrl, galleryImageUrl } and may return a Promise.
 * galleryImageUrl may be null (no optimized variant exists/was generated) — see createGalleryVariant.
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
  // Tracks the blob: URL (if any) this component itself created via
  // URL.createObjectURL, so it — and only it — can be safely revoked. The
  // edit-mode initial previewUrl (initialData.imageUrl) is a real https URL,
  // never tracked here, so it's never accidentally revoked.
  const objectUrlRef = useRef(null);
  // Tracks the in-flight (or settled) gallery-variant generation Promise for
  // whichever file is currently selected, so handleSubmit can always await
  // the LATEST selection's result even if the admin changes the file again
  // before the previous resize finished — avoids a stale-result race.
  const galleryBlobPromiseRef = useRef(null);

  const revokeTrackedObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  // Revoke this component's own blob: preview URL on unmount only — never
  // touches initialData's real http(s) URL.
  useEffect(() => () => revokeTrackedObjectUrl(), []);

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
    // The previous preview (if any) is revoked first — only ever one
    // outstanding blob: URL from this component at a time.
    revokeTrackedObjectUrl();
    const nextPreviewUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);

    // Kick off gallery-variant generation now, in the background — the
    // original File is never touched/modified by this. handleSubmit awaits
    // this exact promise, so even a fast submit-click still gets the
    // correctly-resized result, and a second file selection before this one
    // finishes simply replaces the ref with the new promise (no stale reads).
    galleryBlobPromiseRef.current = createGalleryVariant(file);
  };

  const clearImage = () => {
    setSelectedFile(null);
    revokeTrackedObjectUrl();
    setPreviewUrl('');
    galleryBlobPromiseRef.current = null;
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
      // Preserve the existing gallery variant when the admin edits an item
      // WITHOUT picking a new file (title/description/category-only edits)
      // — only a fresh upload should ever change which gallery image is
      // referenced. Defaults to null for a brand-new 'add' (initialData is
      // null) before any upload has happened.
      let galleryImageUrl = initialData?.galleryImageUrl ?? null;

      if (selectedFile) {
        setStatusMessage('Uploading image…');
        // Always await the LATEST gallery-variant promise for the currently
        // selected file (see handleFileChange) — never undefined/stale.
        // Resolves to null if generation failed; the Worker/uploadImage
        // contract already treats that identically to "no gallery file
        // supplied" (original-only upload, gallery stays unavailable).
        const galleryBlob = await (galleryBlobPromiseRef.current ?? Promise.resolve(null));
        uploadResult = await uploadImage(selectedFile, galleryBlob);
        imageUrl = uploadResult.imageUrl;
        galleryImageUrl = uploadResult.galleryImageUrl; // may be null — that's a valid, expected outcome
      }

      setStatusMessage(mode === 'edit' ? 'Saving changes…' : 'Saving decor…');
      await onSubmit({
        categoryId,
        title: title.trim(),
        description: description.trim(),
        imageUrl,
        galleryImageUrl,
      });

      // Supabase now points at the new image(s) — only NOW is it safe to
      // remove the old one(s). This ordering matters: if the save above had
      // failed, we must not have touched the old image(s) at all (see the
      // catch block, which instead cleans up the NEW upload). This is
      // best-effort and non-blocking of the already-successful save: R2 and
      // Supabase are separate systems with no shared transaction, so a
      // failure here does not get rolled back or re-reported as an error —
      // it's logged (see uploadService), and the edit the admin asked for
      // has already genuinely succeeded.
      if (mode === 'edit' && selectedFile) {
        if (initialData?.imageUrl) {
          await deleteImageByUrl(initialData.imageUrl);
        }
        // Old gallery variant may not exist yet (NULL, e.g. a not-yet-
        // backfilled legacy item) — nothing to delete in that case.
        if (initialData?.galleryImageUrl) {
          await deleteImageByUrl(initialData.galleryImageUrl);
        }
      }
    } catch (err) {
      if (uploadResult) {
        await deleteUploadedImage(uploadResult.deleteUrl);
        // Clean up the newly-uploaded gallery variant too, if one was
        // produced — never leave it orphaned just because the Supabase
        // write that would have referenced it failed.
        if (uploadResult.galleryDeleteUrl) {
          await deleteUploadedImage(uploadResult.galleryDeleteUrl);
        }
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
