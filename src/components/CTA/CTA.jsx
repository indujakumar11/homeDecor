import React from 'react';
import { Calendar, Phone, ArrowRight, Sparkles } from 'lucide-react';
import styles from './CTA.module.scss';

const CTA = ({ onOpenConsultation }) => {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaBg}>
        <img 
          src="assets/services/murals.jpg" 
          alt="Luxury Architecture and Relief Murals" 
          className={styles.ctaBgImage}
          loading="lazy" 
        />
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
            >
              <Phone size={16} />
              <span>CALL +91 97908 38319</span>
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
