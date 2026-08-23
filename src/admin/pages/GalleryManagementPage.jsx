import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ImagePlus, ImageOff } from 'lucide-react';
import { getImages, deleteImage } from '../../services/galleryService';
import { categories } from '../../data/categories';
import AdminLayout from '../layouts/AdminLayout';
import ImageCard from '../components/ImageCard';
import ConfirmDialog from '../components/ConfirmDialog';
import InlineAlert from '../components/InlineAlert';
import styles from './GalleryManagementPage.module.scss';

const GalleryManagementPage = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [deletingImage, setDeletingImage] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setImages(getImages());
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const refresh = () => setImages(getImages());

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      const matchesCategory = activeCategory === 'all' || img.categoryId === activeCategory;
      const matchesSearch = img.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [images, activeCategory, searchQuery]);

  const handleConfirmDelete = () => {
    if (!deletingImage) return;
    deleteImage(deletingImage.id);
    setDeletingImage(null);
    refresh();
    setSuccessMessage('Image deleted successfully.');
  };

  return (
    <AdminLayout fullBleed>
      <div className={styles.fullscreenWrap}>
        <InlineAlert type="success" message={successMessage} className={styles.toast} />

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

        {filteredImages.length === 0 ? (
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
