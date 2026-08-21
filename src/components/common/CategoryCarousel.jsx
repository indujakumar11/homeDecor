import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CategoryCarousel.module.scss';

const CAROUSEL_CATEGORIES = [
  { id: 'murals', title: 'Custom Murals', image: 'assets/services/murals.jpg' },
  { id: 'frp-sculptures', title: 'FRP Sculptures', image: 'assets/services/frp-sculptures.jpg' },
  { id: 'marble-sculptures', title: 'Marble Sculptures', image: 'assets/services/marble-sculptures.jpg' },
  { id: 'parametric', title: '3D Parametric', image: 'assets/services/parametric.jpg' },
  { id: 'interior-decor', title: 'Interior Décor', image: 'assets/services/interior-decor.jpg' },
  { id: 'signage', title: 'Signage & Pylons', image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop' },
  { id: 'corporate', title: 'Corporate Interiors', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop' },
  { id: 'supermarket', title: 'Retail & Warehouse', image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=1200&auto=format&fit=crop' },
  { id: 'turnkey', title: 'Turnkey Execution', image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200&auto=format&fit=crop' },
];

const CategoryCarousel = ({ activeCategoryId, onSelectCategory }) => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 240;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleCategoryClick = (id) => {
    if (onSelectCategory) {
      onSelectCategory(id);
    } else {
      navigate('/services', { state: { selectedServiceId: id } });
    }
  };

  return (
    <div className={styles.carouselSection}>
      <div className={`container ${styles.carouselContainer}`}>
        {/* Navigation Buttons */}
        <button 
          className={`${styles.navBtn} ${styles.prev}`} 
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} />
        </button>

        <div className={styles.scrollWrapper} ref={scrollContainerRef}>
          <div className={styles.categoriesTrack}>
            {CAROUSEL_CATEGORIES.map((cat) => {
              const isActive = activeCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  className={`${styles.categoryItem} ${isActive ? styles.activeItem : ''}`}
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <div className={styles.thumbnailWrapper}>
                    <div className={styles.imageRing}>
                      <img 
                        src={cat.image} 
                        alt={cat.title} 
                        className={styles.thumbnailImage} 
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <span className={styles.categoryTitle}>{cat.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button 
          className={`${styles.navBtn} ${styles.next}`} 
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default CategoryCarousel;
