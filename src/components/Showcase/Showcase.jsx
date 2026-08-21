import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import styles from './Showcase.module.scss';

const Showcase = ({ onOpenConsultation }) => {
  const navigate = useNavigate();

  return (
    <section className={styles.showcaseSection}>
      <div className={styles.showcaseBg}>
        <img 
          src="assets/hero/hero-bg.jpg" 
          alt="Black Shades Architectural Masterpiece" 
          className={styles.bgImg}
          loading="lazy"
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
