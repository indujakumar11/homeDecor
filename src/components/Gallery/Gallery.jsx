import React, { useState, useRef, useMemo } from 'react';
import { ArrowRight, MapPin, Eye, X, Calendar } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../lib/smoothScroll';
import { getImages } from '../../services/galleryService';
import { categories, getCategoryName } from '../../data/categories';
import styles from './Gallery.module.scss';

const CATEGORY_TABS = ['All', ...categories.map((c) => c.name)];

const Gallery = ({ onOpenConsultation }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeProject, setActiveProject] = useState(null);
  const gridRef = useRef(null);

  // Sourced from the shared gallery data layer (services/galleryService.js)
  // so admin-managed changes appear here without any code changes.
  const [images] = useState(() => getImages());
  const projectsData = useMemo(() => images.map((img) => ({
    id: img.id,
    title: img.title,
    category: getCategoryName(img.categoryId),
    location: img.location,
    image: img.imageUrl,
    description: img.description,
    scope: img.scope,
    year: img.year,
  })), [images]);

  const filteredProjects = activeCategory === 'All'
    ? projectsData
    : projectsData.filter((p) => p.category === activeCategory);

  // Reveal on first mount, and re-run as a filter transition whenever the category changes
  useGSAP(() => {
    if (!gridRef.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.06, ease: 'power2.out' }
      );
    });
    return () => mm.revert();
  }, { dependencies: [activeCategory], scope: gridRef });

  const handleOpenProject = (proj) => {
    setActiveProject(proj);
  };

  const handleCloseProject = () => {
    setActiveProject(null);
  };

  return (
    <section id="projects" className={`section-padding ${styles.gallerySection}`}>
      <div className="container">
        {/* Category Filter Tabs */}
        <div className={styles.filterTabsWrapper} role="tablist">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`${styles.filterTab} ${activeCategory === cat ? styles.activeTab : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              <span>{cat}</span>
              {activeCategory === cat && <span className={styles.activePill} />}
            </button>
          ))}
        </div>

        {/* Asymmetric Gallery Grid */}
        <div ref={gridRef} className={styles.galleryGrid}>
          {filteredProjects.map((project, index) => {
            const isFeatured = index === 0 || index === 3;
            return (
              <div 
                key={project.id} 
                className={`${styles.galleryItem} ${isFeatured ? styles.featuredItem : ''}`}
                onClick={() => handleOpenProject(project)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenProject(project);
                  }
                }}
              >
                <div className={styles.imageContainer}>
                  <img
                    src={project.image}
                    alt={project.title}
                    className={styles.projectImage}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className={styles.overlayGradient} />
                  
                  {/* Category Pill Tag */}
                  <span className={styles.categoryBadge}>{project.category}</span>
                </div>

                {/* Information Card Overlay */}
                <div className={styles.projectInfo}>
                  {project.location && (
                    <div className={styles.locationTag}>
                      <MapPin size={12} className={styles.pinIcon} />
                      <span>{project.location}</span>
                    </div>
                  )}

                  <h3 className={styles.projectTitle}>{project.title}</h3>
                  <p className={styles.projectDesc}>{project.description}</p>

                  <div className={styles.viewAction}>
                    <span className={styles.viewActionText}>VIEW PROJECT</span>
                    <ArrowRight size={14} className={styles.actionArrow} />
                  </div>
                </div>

                {/* Gold Frame Highlight */}
                <div className={styles.borderFrame} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Lightbox Modal */}
      {activeProject && (
        <div className={styles.modalBackdrop} onClick={handleCloseProject} role="dialog" aria-modal="true">
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={handleCloseProject} aria-label="Close project view">
              <X size={22} />
            </button>

            <div className={styles.modalImageWrapper}>
              <img src={activeProject.image} alt={activeProject.title} className={styles.modalImg} decoding="async" />
            </div>

            <div className={styles.modalDetails}>
              <div className={styles.modalMetaRow}>
                <span className={styles.modalCategoryBadge}>{activeProject.category}</span>
                {activeProject.location && (
                  <span className={styles.modalLocation}>
                    <MapPin size={13} /> {activeProject.location}
                  </span>
                )}
                {activeProject.year && (
                  <span className={styles.modalYear}>Completed: {activeProject.year}</span>
                )}
              </div>

              <h3 className={styles.modalProjectTitle}>{activeProject.title}</h3>
              <p className={styles.modalProjectDesc}>{activeProject.description}</p>

              {activeProject.scope && (
                <div className={styles.scopeBox}>
                  <span className={styles.scopeLabel}>SCOPE OF WORK</span>
                  <p className={styles.scopeText}>{activeProject.scope}</p>
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className="btn btn-primary-gold"
                  onClick={() => {
                    handleCloseProject();
                    onOpenConsultation(activeProject.title);
                  }}
                >
                  <Calendar size={16} />
                  <span>Inquire For Similar Project</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Gallery;
