import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ImagePlus, ImageOff, Loader2 } from 'lucide-react';
import { getImages, getCategories, deleteImage } from '../../services/galleryService';
import AdminLayout from '../layouts/AdminLayout';
import ImageCard from '../components/ImageCard';
import ConfirmDialog from '../components/ConfirmDialog';
import InlineAlert from '../components/InlineAlert';
import styles from './GalleryManagementPage.module.scss';

const GalleryManagementPage = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [deletingImage, setDeletingImage] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const loadAll = async () => {
    setStatus('loading');
    try {
      const [items, cats] = await Promise.all([getImages(), getCategories()]);
      setImages(items);
      setCategories(cats);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const refresh = async () => {
    try {
      setImages(await getImages());
    } catch {
      setActionError('Unable to refresh the gallery. Please reload the page.');
    }
  };

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      const matchesCategory = activeCategory === 'all' || img.categoryId === activeCategory;
      const matchesSearch = img.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [images, activeCategory, searchQuery]);

  const handleConfirmDelete = async () => {
    if (!deletingImage) return;
    const target = deletingImage;
    setDeletingImage(null);
    try {
      await deleteImage(target.id);
      await refresh();
      setSuccessMessage('Image deleted successfully.');
    } catch {
      setActionError('Failed to delete this image. Please try again.');
    }
  };

  return (
    <AdminLayout fullBleed>
      <div className={styles.fullscreenWrap}>
        <InlineAlert type="success" message={successMessage} className={styles.toast} />
        <InlineAlert type="error" message={actionError} className={styles.toast} />

        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by title…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search images by title"
            />
          </div>

          <div className={styles.filterRow} role="tablist" aria-label="Filter by category">
            <button
              type="button"
              className={`${styles.filterTab} ${activeCategory === 'all' ? styles.activeTab : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.filterTab} ${activeCategory === cat.id ? styles.activeTab : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <Link to="/admin/gallery/add" className={styles.addBtn}>
            <ImagePlus size={16} />
            <span>Add Decor</span>
          </Link>
        </div>

        {status === 'loading' ? (
          <div className={styles.emptyState}>
            <Loader2 size={32} className={styles.spinIcon} />
            <p>Loading decor…</p>
          </div>
        ) : status === 'error' ? (
          <div className={styles.emptyState}>
            <ImageOff size={32} />
            <p>Unable to load decor. Please try again.</p>
            <button type="button" className={styles.emptyCta} onClick={loadAll}>Retry</button>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className={styles.emptyState}>
            <ImageOff size={32} />
            <p>No images found.</p>
            {images.length === 0 && (
              <Link to="/admin/gallery/add" className={styles.emptyCta}>Add your first decor item</Link>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredImages.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                onEdit={(image) => navigate(`/admin/gallery/edit/${image.id}`)}
                onDelete={setDeletingImage}
              />
            ))}
          </div>
        )}

        <ConfirmDialog
          isOpen={Boolean(deletingImage)}
          title="Delete this image?"
          message={deletingImage ? `"${deletingImage.title}" will be permanently removed from the gallery.` : ''}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingImage(null)}
        />
      </div>
    </AdminLayout>
  );
};

export default GalleryManagementPage;
