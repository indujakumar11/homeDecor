import React, { useState, useRef, useMemo, useEffect, useId } from 'react';
import { ArrowRight, MapPin, Eye, X, Calendar, Loader2 } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { gsap, getLenis } from '../../lib/smoothScroll';
import { lockScroll, unlockScroll } from '../../lib/scrollLock';
import { getImages, getCategories } from '../../services/galleryService';
import { servicesData } from '../../data/servicesData';
import styles from './Gallery.module.scss';

// The consultation service for a project, via the services' own categorySlug
// links. Only an unambiguous match counts: a category shared by several
// services (e.g. "sculptures" → FRP and Marble) or linked to none returns ''
// so the visitor picks the service themselves.
const serviceForCategory = (categorySlug) => {
  const matches = servicesData.filter((s) => categorySlug && s.categorySlug === categorySlug);
  return matches.length === 1 ? matches[0].title : '';
};

// Lightbox focus helpers — same approach as ConsultationModal's dialog
// (kept local here; the two could later share one module).
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

// Keyboard-reachable controls inside `root`, in DOM order.
const getFocusable = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0
  );

// Makes everything outside `el` inert (siblings of `el` and of each ancestor up
// to <body>, never an ancestor itself). Returns a function restoring exactly
// what it changed.
const inertOutside = (el) => {
  const changed = [];
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node && !sibling.inert) {
        sibling.inert = true;
        changed.push(sibling);
      }
    }
  }
  return () => changed.forEach((sibling) => { sibling.inert = false; });
};

// Whether focus can sensibly go back to the card that opened the lightbox
// (it may have been filtered out or removed meanwhile).
const canRestoreFocus = (el) => {
  if (!el || !el.isConnected || el === document.body || el.disabled || el.closest('[inert]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

// Lightbox image resolution. The lightbox opens with the card's smaller
// gallery variant (usually already cached by the card) and swaps to the full
// original only when the screen would show more detail than the variant has.
// Device pixel ratio is capped at 1.5: beyond that the extra sharpness is
// hard to see at lightbox size, while the original costs megabytes.
const LIGHTBOX_MAX_DPR = 1.5;

// The visitor asked the browser to save data (where the browser exposes it).
const prefersSaveData = () => navigator.connection?.saveData === true;

// Whether `img`, as rendered, needs more pixels than its loaded file has.
// clientWidth/Height ignore the modal's open animation transform.
const needsMorePixels = (img) => {
  const dpr = Math.min(window.devicePixelRatio || 1, LIGHTBOX_MAX_DPR);
  return img.clientWidth * dpr > img.naturalWidth || img.clientHeight * dpr > img.naturalHeight;
};

const Gallery = ({ onOpenConsultation }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeProject, setActiveProject] = useState(null);
  const [images, setImages] = useState([]);
  const [categoryNames, setCategoryNames] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const gridRef = useRef(null);
  // Only release the shared scroll lock if this modal is the one holding
  // it — mirrors ConsultationModal's guard so an unmount never clobbers a
  // lock some other holder still needs.
  const holdsLockRef = useRef(false);
  const lightboxRef = useRef(null);
  const lightboxTitleRef = useRef(null);
  const lightboxTitleId = useId();
  const lightboxOpen = Boolean(activeProject);
  // Latest close handler for the keydown listener, without re-running the
  // focus effect on every render.
  const closeLightboxRef = useRef(null);
  useEffect(() => {
    closeLightboxRef.current = () => setActiveProject(null);
  });

  // Each lightbox opening gets its own id, so image results from an earlier
  // opening (even of the same project) can never land in a later one.
  const openCountRef = useRef(0);
  // Image source chosen for one opening — { openId, src } — once it differs
  // from the initial one (upgraded to the original, or fallen back to it).
  const [lightboxImage, setLightboxImage] = useState(null);
  // Cancels the in-flight original-image load, if any.
  const cancelOriginalRef = useRef(null);
  const activeOpenId = activeProject?.openId;
  useEffect(() => () => {
    cancelOriginalRef.current?.();
    cancelOriginalRef.current = null;
  }, [activeOpenId]);

  // Lightbox keyboard behaviour while open: background inert, focus on the
  // project title, Tab/Shift+Tab kept inside, Escape closes. On close (or
  // unmount) the background and focus are restored to the card that opened it.
  useEffect(() => {
    if (!lightboxOpen || !lightboxRef.current) return undefined;
    const dialog = lightboxRef.current;
    const opener = document.activeElement;
    const restoreInert = inertOutside(dialog);
    // preventScroll: the title sits below the image — keep the image in view.
    lightboxTitleRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightboxRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        e.preventDefault();
        lightboxTitleRef.current?.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      restoreInert();
      if (canRestoreFocus(opener)) opener.focus({ preventScroll: true });
    };
  }, [lightboxOpen]);

  useEffect(() => {
    const lenis = getLenis();
    if (activeProject) {
      lockScroll();
      holdsLockRef.current = true;
      lenis?.stop();
    } else if (holdsLockRef.current) {
      unlockScroll();
      holdsLockRef.current = false;
      lenis?.start();
    }

    return () => {
      if (holdsLockRef.current) {
        unlockScroll();
        holdsLockRef.current = false;
        getLenis()?.start();
      }
    };
  }, [activeProject]);

  const CATEGORY_TABS = useMemo(() => ['All', ...categoryNames], [categoryNames]);

  // Sourced from the shared gallery data layer (services/galleryService.js)
  // so admin-managed changes appear here without any code changes.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.all([getImages(), getCategories()])
      .then(([items, cats]) => {
        if (cancelled) return;
        setImages(items);
        setCategoryNames(cats.map((c) => c.name));
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  const projectsData = useMemo(() => images.map((img) => ({
    id: img.id,
    title: img.title,
    category: img.categoryName,
    categorySlug: img.categorySlug,
    location: img.location,
    image: img.imageUrl,
    // Phase 1 gallery-image-optimization: optional, smaller WebP variant of
    // `image` — null for any item without one yet. The grid card uses it
    // (falling back to the original); the lightbox opens with it too and
    // upgrades to `image` only when the screen needs more pixels.
    galleryImage: img.galleryImageUrl,
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

  // `card` is the clicked grid item. Its thumbnail is the same photo as the
  // lightbox image (a smaller variant of it, or the same file), so its
  // natural size gives the lightbox image's aspect ratio before the image
  // loads — letting the modal reserve that space instead of growing when
  // the image arrives (or when it is swapped for the original). No usable
  // thumbnail (still loading, or failed) → no ratio, and the modal falls
  // back to sizing on load.
  const handleOpenProject = (proj, card) => {
    const thumb = card?.querySelector('img');
    const hasSize = thumb?.naturalWidth > 0 && thumb?.naturalHeight > 0;
    openCountRef.current += 1;
    setActiveProject({
      ...proj,
      openId: openCountRef.current,
      imageRatio: hasSize ? thumb.naturalWidth / thumb.naturalHeight : null,
      // When the thumbnail IS the only lightbox file (no gallery variant),
      // never upscale past its real width (the lightbox shows images at
      // natural size at most).
      imageMaxWidth: hasSize && !proj.galleryImage ? thumb.naturalWidth : null,
    });
  };

  const handleCloseProject = () => {
    setActiveProject(null);
  };

  // The lightbox shows the gallery variant unless this opening has moved on
  // to the original (an upgrade, or a fallback after the variant failed).
  const lightboxSrc = activeProject
    ? (lightboxImage?.openId === activeProject.openId
      ? lightboxImage.src
      : activeProject.galleryImage ?? activeProject.image)
    : null;

  // Once the variant has loaded, fetch and decode the original in the
  // background if the screen needs more pixels, then swap it in. Only when
  // the box was reserved from the card's ratio (so the swap can't change the
  // layout), and never in Data Saver mode.
  const handleLightboxImageLoad = (e) => {
    const img = e.currentTarget;
    const project = activeProject;
    if (!project?.galleryImage || project.galleryImage === project.image) return;
    if (img.getAttribute('src') !== project.galleryImage) return;
    if (!project.imageRatio || cancelOriginalRef.current || prefersSaveData() || !needsMorePixels(img)) return;

    const { openId, image: original } = project;
    const loader = new Image();
    let cancelled = false;
    cancelOriginalRef.current = () => {
      cancelled = true;
      loader.removeAttribute('src'); // stops the download
    };
    loader.src = original;
    loader.decode().then(
      () => {
        if (cancelled) return;
        cancelOriginalRef.current = null;
        setLightboxImage({ openId, src: original });
      },
      // The original failed to load or decode — keep showing the variant.
      () => { if (!cancelled) cancelOriginalRef.current = null; }
    );
  };

  // The variant failed → fall back to the original, once. If the original
  // fails too there is nothing safer to try, so leave it.
  const handleLightboxImageError = (e) => {
    const project = activeProject;
    if (!project || e.currentTarget.getAttribute('src') === project.image) return;
    setLightboxImage({ openId: project.openId, src: project.image });
  };

  return (
    <section id="projects" className={`section-padding ${styles.gallerySection}`}>
      <div className="container">
        {status === 'loading' ? (
          <div className={`${styles.stateMessage} ${styles.stateLoading}`}>
            <Loader2 size={28} className={styles.stateSpinner} />
            <p>Loading decor…</p>
          </div>
        ) : status === 'error' ? (
          <div className={styles.stateMessage}>
            <p>Unable to load decor. Please try again.</p>
          </div>
        ) : (
          <>
            {/* Category filter — toggle buttons (one grid of results, filtered;
                not separate tab panels), the selected one marked aria-pressed. */}
            <div className={styles.filterTabsWrapper} role="group" aria-label="Filter projects by category">
              {CATEGORY_TABS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={activeCategory === cat}
                  className={`${styles.filterTab} ${activeCategory === cat ? styles.activeTab : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span>{cat}</span>
                  {activeCategory === cat && <span className={styles.activePill} />}
                </button>
              ))}
            </div>

            {filteredProjects.length === 0 ? (
              <div className={styles.stateMessage}>
                <p>No decor available.</p>
              </div>
            ) : (
              <div ref={gridRef} className={styles.galleryGrid}>
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={styles.galleryItem}
                    onClick={(e) => handleOpenProject(project, e.currentTarget)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenProject(project, e.currentTarget);
                      }
                    }}
                  >
                    <div className={styles.imageContainer}>
                      <img
                        src={project.galleryImage ?? project.image}
                        alt={project.title}
                        className={styles.projectImage}
                        loading="lazy"
                        decoding="async"
                      />

                      {project.category && (
                        <span className={styles.categoryBadge}>{project.category}</span>
                      )}
                    </div>

                    <div className={styles.viewAction}>
                      <span className={styles.viewActionText}>View Project</span>
                      <ArrowRight size={14} className={styles.actionArrow} />
                    </div>

                    {/* Gold Frame Highlight */}
                    <div className={styles.borderFrame} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Project Lightbox Modal */}
      {activeProject && (
        <div
          ref={lightboxRef}
          className={styles.modalBackdrop}
          data-lenis-prevent
          onClick={handleCloseProject}
          role="dialog"
          aria-modal="true"
          aria-labelledby={lightboxTitleId}
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={handleCloseProject} aria-label="Close project view">
              <X size={22} />
            </button>

            <div className={styles.modalImageWrapper}>
              <img
                key={activeProject.openId}
                src={lightboxSrc}
                onLoad={handleLightboxImageLoad}
                onError={handleLightboxImageError}
                alt={activeProject.title}
                className={`${styles.modalImg} ${activeProject.imageRatio ? styles.modalImgSized : ''}`}
                style={activeProject.imageRatio ? {
                  '--img-ratio': activeProject.imageRatio,
                  '--img-max-w': activeProject.imageMaxWidth ? `${activeProject.imageMaxWidth}px` : '100%',
                } : undefined}
                decoding="async"
              />
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

              <h3 id={lightboxTitleId} ref={lightboxTitleRef} tabIndex={-1} className={styles.modalProjectTitle}>
                {activeProject.title}
              </h3>
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
                    onOpenConsultation(serviceForCategory(activeProject.categorySlug), activeProject.title);
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
