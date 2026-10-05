import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CategoryCarousel.module.scss';

// Each `image` points at a dedicated <=200px-long-edge WebP thumbnail
// (generated from the full-resolution originals by scripts/generate-
// category-thumbnails.mjs — see that file's header comment), not the
// original full-resolution file. The originals are untouched and still
// live alongside these at the same path, just never referenced by this
// carousel. width/height are each thumbnail's own actual generated pixel
// dimensions (aspect ratio preserved, never upscaled) — purely an
// intrinsic-size hint for the browser; CategoryCarousel.module.scss's
// .thumbnailImage already forces width:100%/height:100% of a fixed-size
// circular container, so these attributes change nothing about the
// rendered appearance.
const CAROUSEL_CATEGORIES = [
  { id: 'murals', title: 'Custom Murals', image: 'assets/categories/murals-thumb.webp', width: 192, height: 200 },
  { id: 'frp-sculptures', title: 'FRP Sculptures', image: 'assets/categories/frp-sculptures-thumb.webp', width: 150, height: 200 },
  { id: 'marble-sculptures', title: 'Marble Sculptures', image: 'assets/categories/marble-sculptures-thumb.webp', width: 112, height: 200 },
  { id: 'parametric', title: '3D Parametric', image: 'assets/categories/parametric-thumb.webp', width: 150, height: 200 },
  { id: 'interior-decor', title: 'Interior Décor', image: 'assets/categories/interior-decor-thumb.webp', width: 113, height: 200 },
  { id: 'signage', title: 'Signage & Pylons', image: 'assets/services/signage-thumb.webp', width: 200, height: 133 },
  { id: 'corporate', title: 'Corporate Interiors', image: 'assets/services/corporate-thumb.webp', width: 200, height: 134 },
  { id: 'supermarket', title: 'Retail & Warehouse', image: 'assets/services/supermarket-thumb.webp', width: 200, height: 150 },
  { id: 'turnkey', title: 'Turnkey Execution', image: 'assets/services/turnkey-thumb.webp', width: 200, height: 112 },
];

// Continuously scrolling, marquee-style category strip. Items stay fully
// clickable — only the CSS keyframe on the track wrapper does the looping,
// the same technique as the text Marquee (duplicate the content once, slide
// exactly -50%, jump back). The duplicate copy is aria-hidden/untabbable
// since it's a purely visual continuation of the real, interactive one.
const CategoryCarousel = ({ activeCategoryId, onSelectCategory }) => {
  const navigate = useNavigate();

  const handleCategoryClick = (id) => {
    if (onSelectCategory) {
      onSelectCategory(id);
    } else {
      navigate('/services', { state: { selectedServiceId: id } });
    }
  };

  const renderItems = (isDuplicate) => CAROUSEL_CATEGORIES.map((cat) => {
    const isActive = activeCategoryId === cat.id;
    return (
      <button
        key={`${isDuplicate ? 'dup' : 'main'}-${cat.id}`}
        type="button"
        className={`${styles.categoryItem} ${isActive ? styles.activeItem : ''}`}
        onClick={() => handleCategoryClick(cat.id)}
        tabIndex={isDuplicate ? -1 : 0}
        aria-hidden={isDuplicate || undefined}
      >
        <div className={styles.thumbnailWrapper}>
          <div className={styles.imageRing}>
            <img
              src={cat.image}
              alt={cat.title}
              className={styles.thumbnailImage}
              width={cat.width}
              height={cat.height}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
        <span className={styles.categoryTitle}>{cat.title}</span>
      </button>
    );
  });

  return (
    <div className={styles.carouselSection}>
      <div className={styles.trackWrapper}>
        <div className={styles.track}>{renderItems(false)}</div>
        <div className={styles.track}>{renderItems(true)}</div>
      </div>
    </div>
  );
};

export default CategoryCarousel;
