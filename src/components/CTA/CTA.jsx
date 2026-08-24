import React, { useRef } from 'react';
import { Calendar, Phone, ArrowRight, Sparkles } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../lib/smoothScroll';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import styles from './CTA.module.scss';

const CTA = ({ onOpenConsultation }) => {
  const bgImgRef = useRef(null);
  const sectionRef = useScrollReveal({ selector: `.${styles.ctaContent}` });

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        bgImgRef.current,
        { scale: 1 },
        {
          scale: 1.1,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      );
    });
    return () => mm.revert();
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className={styles.ctaSection}>
      <div className={styles.ctaBg}>
        <div ref={bgImgRef} className={styles.ctaBgScale}>
          <img
            src="assets/services/murals.webp"
            alt="Luxury Architecture and Relief Murals"
            className={styles.ctaBgImage}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className={styles.ctaOverlay} />
        <div className="grid-bg-overlay" />
      </div>

      <div className={`container ${styles.ctaContainer}`}>
        <div className={styles.ctaContent}>
          <div className="eyebrow">BEGIN YOUR SPATIAL TRANSFORMATION</div>

          <h2 className={styles.ctaHeading}>
            LET'S CREATE SOMETHING <span className="gold-text">EXTRAORDINARY.</span>
          </h2>

          <p className={styles.ctaText}>
            Have a space in mind? From custom sculpted relief walls to turnkey corporate & villa fit-outs, let's transform your vision into a distinctive experience.
          </p>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`btn btn-primary-gold ${styles.consultBtn}`}
              onClick={onOpenConsultation}
            >
              <Calendar size={16} />
              <span>BOOK A CONSULTATION</span>
            </button>

            <a
              href="tel:+919790838319"
              className={`btn btn-outline-gold ${styles.callBtn}`}
              aria-label="Call Black Shades at +91 97908 38319"
            >
              <Phone size={16} />
            </a>
          </div>

          <div className={styles.consultPrompt}>
            <span>Chennai & Surrounding Areas • Turnkey Site Visits Available</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
