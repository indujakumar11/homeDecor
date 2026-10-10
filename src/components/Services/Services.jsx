import React, { useState, useEffect, useRef, useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { servicesData } from '../../data/servicesData';
import { ArrowRight, Sparkles, Check, X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { getLenis, prefersReducedMotion } from '../../lib/smoothScroll';
import { lockScroll, unlockScroll } from '../../lib/scrollLock';
import { getCategories, getImagesByCategory } from '../../services/galleryService';
import styles from './Services.module.scss';

// Detail-dialog focus helpers — same approach as ConsultationModal's and the
// Gallery lightbox's (kept local here; they could later share one module).
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

// Keyboard-reachable controls inside `root`, in DOM order. Read on every Tab
// press, so carousel buttons that appear after images load are included.
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

// Whether focus can sensibly go back to the card that opened the dialog (it
// may be gone, e.g. when the dialog was opened from the Home page).
const canRestoreFocus = (el) => {
  if (!el || !el.isConnected || el === document.body || el.disabled || el.closest('[inert]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

const Services = ({ onOpenConsultation }) => {
  const [selectedService, setSelectedService] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Track whether the modal was opened from the Home page carousel
  const openedFromHomeRef = useRef(false);
  // Only release the shared scroll lock if this modal is the one holding
  // it — mirrors ConsultationModal's guard so an unmount never clobbers a
  // lock some other holder still needs.
  const holdsLockRef = useRef(false);
  const gridRef = useScrollReveal({ selector: `.${styles.serviceCard}`, y: 32 });
  const dialogRef = useRef(null);
  const dialogTitleRef = useRef(null);
  const dialogTitleId = useId();
  const dialogOpen = Boolean(selectedService);
  // Latest close handler (it may navigate home) for the keydown listener,
  // without re-running the focus effect on every render.
  const closeDialogRef = useRef(null);

  // Service-detail image carousel: starts as just the service's own static
  // image (always slide 1), then grows with other decor_items from the same
  // Supabase category (if the service has one — see servicesData.js's
  // categorySlug) once that fetch resolves. Categories are loaded once per
  // page visit, not per service click.
  const [categories, setCategories] = useState([]);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  // Which way the slide should visually enter from — 1 = next (slides in
  // from the right, i.e. left-to-right motion), -1 = previous (from the
  // left). Drives the CSS animation class on the image.
  const [slideDirection, setSlideDirection] = useState(1);
  // Bumped on every manual nav (arrow/dot/keyboard/swipe) so the autoplay
  // effect below restarts its timer instead of advancing right after a
  // manual change.
  const [autoplayResetKey, setAutoplayResetKey] = useState(0);
  const touchStartXRef = useRef(null);

  useEffect(() => {
    const lenis = getLenis();
    if (selectedService) {
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
  }, [selectedService]);

  useEffect(() => {
    if (location.state && location.state.selectedServiceId) {
      const matched = servicesData.find((s) => s.id === location.state.selectedServiceId);
      if (matched) {
        openedFromHomeRef.current = true;
        setSelectedService(matched);
        // Clear location state after opening to avoid reopening on refresh
        window.history.replaceState({}, document.title);
      }
    }
  }, [location]);

  const handleOpenDetail = (service) => {
    openedFromHomeRef.current = false; // opened directly on Services page
    setSelectedService(service);
  };

  const handleCloseModal = () => {
    setSelectedService(null);
    if (openedFromHomeRef.current) {
      openedFromHomeRef.current = false;
      navigate('/');
    }
  };

  useEffect(() => {
    closeDialogRef.current = handleCloseModal;
  });

  // Detail dialog keyboard behaviour while open: background inert, focus on
  // the service title, Tab/Shift+Tab kept inside, Escape closes. On close (or
  // unmount) the background and focus are restored to the card that opened it.
  useEffect(() => {
    if (!dialogOpen || !dialogRef.current) return undefined;
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const restoreInert = inertOutside(dialog);
    // preventScroll: on narrow screens the title sits below the image.
    dialogTitleRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialogRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        e.preventDefault();
        dialogTitleRef.current?.focus({ preventScroll: true });
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
  }, [dialogOpen]);

  // Categories are only needed to resolve a service's categorySlug to a
  // Supabase category id — fetched once, reused for every service the
  // visitor opens during this page visit (no per-click refetch).
  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((cats) => { if (!cancelled) setCategories(cats); })
      .catch(() => {}); // carousels just stay single-image if this fails
    return () => { cancelled = true; };
  }, []);

  // The service's own image is always slide 1, and never disappears while
  // extra images load — reset happens synchronously on open/close/switch.
  useEffect(() => {
    setCarouselIndex(0);
    setCarouselImages(selectedService ? [selectedService.image] : []);
    setCarouselPaused(false);
  }, [selectedService]);

  // Extends the carousel with other decor_items from the same category, once
  // categories have loaded. Re-runs if categories finish loading after the
  // modal was already opened. A stale/cancelled fetch (service switched
  // before this resolved) never writes into state.
  useEffect(() => {
    if (!selectedService?.categorySlug || categories.length === 0) return;
    const category = categories.find((c) => c.slug === selectedService.categorySlug);
    if (!category) return;

    let cancelled = false;
    getImagesByCategory(category.id)
      .then((items) => {
        if (cancelled) return;
        const extra = items.map((item) => item.imageUrl).filter((url) => url && url !== selectedService.image);
        if (extra.length === 0) return;
        setCarouselImages((prev) => {
          const base = prev.length ? prev : [selectedService.image];
          const seen = new Set(base);
          const merged = [...base];
          for (const url of extra) {
            if (!seen.has(url)) {
              seen.add(url);
              merged.push(url);
            }
          }
          return merged;
        });
      })
      .catch(() => {}); // a failed fetch just leaves the carousel at the single existing image
    return () => { cancelled = true; };
  }, [selectedService, categories]);

  // Autoplay — advances one slide at a time while the modal is open, there's
  // more than one image, the visitor isn't hovering/touching it, and
  // prefers-reduced-motion isn't set (same convention the site's other
  // animations already follow). Manual navigation bumps autoplayResetKey so
  // the timer restarts instead of double-advancing right after a click.
  useEffect(() => {
    if (!selectedService || carouselImages.length <= 1 || carouselPaused || prefersReducedMotion()) return;
    const id = setInterval(() => {
      setSlideDirection(1);
      setCarouselIndex((i) => (i + 1) % carouselImages.length);
    }, 3000);
    return () => clearInterval(id);
  }, [selectedService, carouselImages.length, carouselPaused, autoplayResetKey]);

  const goPrevSlide = () => {
    setSlideDirection(-1);
    setCarouselIndex((i) => (i - 1 + carouselImages.length) % carouselImages.length);
    setAutoplayResetKey((k) => k + 1);
  };

  const goNextSlide = () => {
    setSlideDirection(1);
    setCarouselIndex((i) => (i + 1) % carouselImages.length);
    setAutoplayResetKey((k) => k + 1);
  };

  const goToSlide = (idx) => {
    setSlideDirection(idx >= carouselIndex ? 1 : -1);
    setCarouselIndex(idx);
    setAutoplayResetKey((k) => k + 1);
  };

  const handleCarouselKeyDown = (e) => {
    if (carouselImages.length <= 1) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrevSlide(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goNextSlide(); }
  };

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    setCarouselPaused(true);
  };

  const handleTouchEnd = (e) => {
    setCarouselPaused(false);
    if (touchStartXRef.current == null || carouselImages.length <= 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD) goPrevSlide();
    else if (deltaX < -SWIPE_THRESHOLD) goNextSlide();
  };

  // A broken slide is dropped rather than left showing a broken-image icon —
  // except the last remaining one, so the carousel never ends up empty.
  const handleSlideError = (idx) => {
    setCarouselImages((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
    setCarouselIndex((i) => (i >= idx ? Math.max(0, i - 1) : i));
  };

  return (
    <section id="services" className={`section-padding ${styles.servicesSection}`}>
      <div className="container">
        {/* 9 Architectural Service Cards Grid */}
        <div ref={gridRef} className={styles.servicesGrid}>
          {servicesData.map((service, index) => (
            <article
              key={service.id}
              className={`${styles.serviceCard} ${index === 0 ? styles.featuredCard : ''}`}
              onClick={() => handleOpenDetail(service)}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${service.title}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenDetail(service);
                }
              }}
            >
              {/* Card Image Container */}
              <div className={styles.cardImageWrapper}>
                <img
                  src={service.image}
                  alt={service.title}
                  className={styles.cardImage}
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.imageOverlayGradient} />
                
                {/* Category Number Tag */}
                <span className={styles.numberBadge}>{service.number}</span>
              </div>

              {/* Card Content */}
              <div className={styles.cardBody}>
                <div className={styles.cardHeaderRow}>
                  <h3 className={styles.cardTitle}>{service.title}</h3>
                </div>
                
                <p className={styles.cardDescription}>{service.description}</p>

                {/* Card Footer Action */}
                <div className={styles.cardFooter}>
                  <span className={styles.viewDetailsText}>VIEW DETAILS</span>
                  <div className={styles.arrowCircle}>
                    <ArrowRight size={15} className={styles.arrowIcon} />
                  </div>
                </div>
              </div>

              {/* Gold Border Glow Accent */}
              <div className={styles.borderHighlight} />
            </article>
          ))}
        </div>
      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <div
          ref={dialogRef}
          className={styles.modalBackdrop}
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
        >
          <div
            className={styles.modalContainer}
            data-lenis-prevent
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.modalCloseBtn}
              onClick={handleCloseModal}
              aria-label="Close service details"
            >
              <X size={22} />
            </button>

            <div className={styles.modalGrid}>
              <div
                className={styles.modalImageCol}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onKeyDown={handleCarouselKeyDown}
                onMouseEnter={() => setCarouselPaused(true)}
                onMouseLeave={() => setCarouselPaused(false)}
              >
                <img
                  key={carouselImages[carouselIndex] || selectedService.image}
                  src={carouselImages[carouselIndex] || selectedService.image}
                  alt={selectedService.title}
                  className={`${styles.modalImg} ${slideDirection === 1 ? styles.slideNext : styles.slidePrev}`}
                  decoding="async"
                  onError={() => handleSlideError(carouselIndex)}
                />
                <div className={styles.modalImgOverlay} />
                <span className={styles.modalNumber}>{selectedService.number}</span>

                {carouselImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      className={`${styles.carouselArrow} ${styles.carouselArrowPrev}`}
                      onClick={goPrevSlide}
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.carouselArrow} ${styles.carouselArrowNext}`}
                      onClick={goNextSlide}
                      aria-label="Next image"
                    >
                      <ChevronRight size={20} />
                    </button>

                    <div className={styles.carouselDots} role="tablist" aria-label="Service images">
                      {carouselImages.map((img, idx) => (
                        <button
                          key={img}
                          type="button"
                          role="tab"
                          aria-selected={idx === carouselIndex}
                          aria-label={`Show image ${idx + 1} of ${carouselImages.length}`}
                          className={`${styles.carouselDot} ${idx === carouselIndex ? styles.carouselDotActive : ''}`}
                          onClick={() => goToSlide(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.modalContentCol}>
                <span className="eyebrow no-decor">{selectedService.subtitle}</span>
                <h3 id={dialogTitleId} ref={dialogTitleRef} tabIndex={-1} className={styles.modalTitle}>
                  {selectedService.title}
                </h3>
                
                <p className={styles.modalDetailsText}>{selectedService.details}</p>

                <div className={styles.featuresBox}>
                  <h4 className={styles.featuresHeading}>KEY CAPABILITIES</h4>
                  <ul className={styles.featuresList}>
                    {selectedService.features.map((feat, idx) => (
                      <li key={idx} className={styles.featureItem}>
                        <Check size={14} className={styles.checkIcon} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className="btn btn-primary-gold"
                    onClick={() => {
                      handleCloseModal();
                      onOpenConsultation(selectedService.title);
                    }}
                  >
                    <Calendar size={16} />
                    <span>Inquire About This Service</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-gold"
                    onClick={handleCloseModal}
                  >
                    <span>Close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Services;
