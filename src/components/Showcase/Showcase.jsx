import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../lib/smoothScroll';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import styles from './Showcase.module.scss';

const Showcase = ({ onOpenConsultation }) => {
  const navigate = useNavigate();
  const bgImgRef = useRef(null);
  const sectionRef = useScrollReveal({ selector: `.${styles.showcaseBox}` });

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        bgImgRef.current,
        { scale: 1 },
        {
          scale: 1.12,
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
    <section ref={sectionRef} className={styles.showcaseSection}>
      <div className={styles.showcaseBg}>
        <img
          ref={bgImgRef}
          src="assets/hero/hero-bg.jpg"
          alt="Black Shades Architectural Masterpiece"
          className={styles.bgImg}
          loading="lazy"
          decoding="async"
        />
        <div className={styles.showcaseOverlay} />
      </div>

      <div className={`container ${styles.showcaseContainer}`}>
        <div className={styles.showcaseBox}>
          <div className="eyebrow">DISTINCTIVE ARCHITECTURAL EXCELLENCE</div>

          <h2 className={styles.showcaseTitle}>
            CRAFTED FOR <span className="gold-text">IMPACT.</span>
          </h2>

          <div className="gold-divider" />

          <p className={styles.showcaseText}>
            From high-relief sculpted walls to monolithic corporate environments, our multidisciplinary studio transforms raw space into enduring architectural statements that elevate living and commerce.
          </p>

          <div className={styles.btnGroup}>
            <button
              type="button"
              className="btn btn-primary-gold"
              onClick={onOpenConsultation}
            >
              <span>Start Your Project</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="btn btn-outline-gold"
              onClick={() => navigate('/projects')}
            >
              <span>Explore Portfolio</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Showcase;
