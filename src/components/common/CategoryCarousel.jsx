import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CategoryCarousel.module.scss';

const CAROUSEL_CATEGORIES = [
  { id: 'murals', title: 'Custom Murals', image: 'assets/services/murals.webp' },
  { id: 'frp-sculptures', title: 'FRP Sculptures', image: 'assets/services/frp-sculptures.webp' },
  { id: 'marble-sculptures', title: 'Marble Sculptures', image: 'assets/services/marble-sculptures.webp' },
  { id: 'parametric', title: '3D Parametric', image: 'assets/services/parametric.webp' },
  { id: 'interior-decor', title: 'Interior Décor', image: 'assets/services/interior-decor.webp' },
  { id: 'signage', title: 'Signage & Pylons', image: 'assets/services/signage.webp' },
  { id: 'corporate', title: 'Corporate Interiors', image: 'assets/services/corporate.webp' },
  { id: 'supermarket', title: 'Retail & Warehouse', image: 'assets/services/supermarket.webp' },
  { id: 'turnkey', title: 'Turnkey Execution', image: 'assets/services/turnkey.webp' },
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
