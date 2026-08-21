import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Sparkles, Compass, Eye, Calendar } from 'lucide-react';
import styles from './Hero.module.scss';

const Hero = ({ onOpenConsultation }) => {
  const navigate = useNavigate();
  const handleScrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="home" className={styles.heroSection}>
      {/* Background Image with Dark Vignette & Parallax feel */}
      <div className={styles.heroBgWrapper}>
        <img 
          src="assets/hero/hero-bg.jpg" 
          alt="Black Shades Luxury Interior & Architectural Decor" 
          className={styles.heroBgImage} 
        />
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
          <div className={styles.brandBadge}>
            <span className={styles.badgeLine}></span>
            <span className={styles.badgeText}>WE DESIGN • WE SCULPT • WE CREATE</span>
            <span className={styles.badgeLine}></span>
          </div>

          {/* Subtitle / Company Name */}
          <div className={styles.companySubheader}>
            <span className={styles.blackShades}>BLACK SHADES</span>
            <span className={styles.decorDot}>•</span>
            <span className={styles.homeDecors}>HOME DECORS</span>
          </div>

          {/* Main Headline */}
          <h1 className={styles.headline}>
            Spaces That <span className="gold-text">Inspire.</span>
          </h1>

          {/* Supporting Text */}
          <p className={styles.subtext}>
            We design, sculpt and create distinctive spaces through premium décor, custom craftsmanship and complete interior solutions across Chennai & beyond.
          </p>

          {/* CTA Group */}
          <div className={styles.ctaGroup}>
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
          <div className={styles.heroMicroPills}>
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
        aria-label="Scroll down to explore"
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
