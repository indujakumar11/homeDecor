import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Eye, Calendar } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { gsap, getLenis } from '../../lib/smoothScroll';
import { onPreloaderComplete } from '../../lib/preloaderSignal';
import styles from './Hero.module.scss';

const Hero = ({ onOpenConsultation }) => {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  // Entrance timeline waits for the Preloader (see lib/preloaderSignal.js)
  // so the reveal and Hero's own animation feel like one continuous moment
  // instead of racing each other.
  const [ready, setReady] = useState(false);
  const bgImageRef = useRef(null);
  const badgeRef = useRef(null);
  const subheaderRef = useRef(null);
  const headlineRef = useRef(null);
  const subtextRef = useRef(null);
  const ctaRef = useRef(null);
  const pillsRef = useRef(null);

  const handleScrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(el, { offset: -80 });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => onPreloaderComplete(() => setReady(true)), []);

  useGSAP(() => {
    if (!ready) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.set(bgImageRef.current, { scale: 1.15 });

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.to(bgImageRef.current, { scale: 1.04, duration: 1.6, ease: 'power2.out' }, 0)
        .from(badgeRef.current, { opacity: 0, y: 18, duration: 0.7 }, 0.15)
        .from(subheaderRef.current, { opacity: 0, y: 18, duration: 0.7 }, 0.3)
        .from(headlineRef.current, { opacity: 0, y: 28, duration: 0.9 }, 0.42)
        .from(subtextRef.current, { opacity: 0, y: 18, duration: 0.7 }, 0.62)
        .from(ctaRef.current.children, { opacity: 0, y: 16, duration: 0.6, stagger: 0.1 }, 0.78)
        .from(pillsRef.current, { opacity: 0, y: 14, duration: 0.6 }, 0.95);

      // Gentle parallax: background drifts down slightly slower than the
      // page scrolls, so it reads as nearly still against the text moving
      // past it at full scroll speed. Targets the unfiltered scale wrapper
      // (not the filtered <img>) to stay on the compositor-only fast path.
      gsap.to(bgImageRef.current, {
        y: 120,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    });

    return () => mm.revert();
  }, { scope: sectionRef, dependencies: [ready] });

  return (
    <section id="home" ref={sectionRef} className={styles.heroSection}>
      {/* Background Image with Dark Vignette & Parallax feel */}
      <div className={styles.heroBgWrapper}>
        <div ref={bgImageRef} className={styles.heroBgScale}>
          <img
            src="assets/hero/hero-bg.webp"
            alt="Black Shades Luxury Interior & Architectural Decor"
            className={styles.heroBgImage}
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div className={styles.heroOverlayGradient} />
        <div className={styles.heroVignette} />
        <div className="grid-bg-overlay" />
      </div>

      {/* Decorative Architectural Corner Accents */}
      <div className={styles.cornerTopLeft}></div>
      <div className={styles.cornerTopRight}></div>
      <div className={styles.cornerBottomLeft}></div>
      <div className={styles.cornerBottomRight}></div>

      <div className={`container ${styles.heroContainer}`}>
        <div className={styles.heroContent}>
          {/* Brand Monogram Tag */}
          <div ref={badgeRef} className={styles.brandBadge}>
            <span className={styles.badgeLine}></span>
            <span className={styles.badgeText}>WE DESIGN • WE SCULPT • WE CREATE</span>
            <span className={styles.badgeLine}></span>
          </div>

          {/* Subtitle / Company Name */}
          <div ref={subheaderRef} className={styles.companySubheader}>
            <span className={styles.blackShades}>BLACK SHADES</span>
            <span className={styles.decorDot}>•</span>
            <span className={styles.homeDecors}>HOME DECORS</span>
          </div>

          {/* Main Headline */}
          <h1 ref={headlineRef} className={styles.headline}>
            Spaces That <span className="gold-text">Inspire.</span>
          </h1>

          {/* Supporting Text */}
          <p ref={subtextRef} className={styles.subtext}>
            We design, sculpt and create distinctive spaces through premium décor, custom craftsmanship and complete interior solutions across Chennai & beyond.
          </p>

          {/* CTA Group */}
          <div ref={ctaRef} className={styles.ctaGroup}>
            <button
              type="button"
              className={`btn btn-primary-gold ${styles.primaryCta}`}
              onClick={onOpenConsultation}
            >
              <Calendar size={16} />
              <span>Book a Consultation</span>
            </button>

            <button
              type="button"
              className={`btn btn-outline-gold ${styles.secondaryCta}`}
              onClick={() => navigate('/projects')}
            >
              <Eye size={16} />
              <span>Explore Our Work</span>
            </button>
          </div>

          {/* Value Micro Highlights */}
          <div ref={pillsRef} className={styles.heroMicroPills}>
            <span className={styles.pillItem}>
              <span className={styles.goldDot}></span> Custom Murals & Relief
            </span>
            <span className={styles.pillDivider}>/</span>
            <span className={styles.pillItem}>
              <span className={styles.goldDot}></span> FRP & Stone Sculptures
            </span>
            <span className={styles.pillDivider}>/</span>
            <span className={styles.pillItem}>
              <span className={styles.goldDot}></span> Turnkey Execution
            </span>
          </div>
        </div>
      </div>

      {/* Subtle Animated Scroll Indicator */}
      <button
        type="button"
        className={styles.scrollIndicator}
        onClick={() => handleScrollToSection('trust-strip')}
        aria-label="Scroll to explore the site"
      >
        <span className={styles.scrollLabel}>SCROLL TO EXPLORE</span>
        <div className={styles.scrollIconWrapper}>
          <ArrowDown size={14} className={styles.bounceArrow} />
        </div>
      </button>
    </section>
  );
};

export default Hero;
