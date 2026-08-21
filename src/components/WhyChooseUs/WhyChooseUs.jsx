import React from 'react';
import { Lightbulb, Gem, Palette, Clock, Maximize, CheckCircle, Sparkles, MessageSquare } from 'lucide-react';
import { whyChooseData } from '../../data/whyChooseData';
import styles from './WhyChooseUs.module.scss';

const iconMap = {
  Lightbulb: Lightbulb,
  Gem: Gem,
  Palette: Palette,
  Clock: Clock,
  Maximize: Maximize,
  CheckCircle: CheckCircle
};

const WhyChooseUs = ({ onOpenConsultation }) => {
  return (
    <section id="why-choose" className={`section-padding ${styles.whySection}`}>
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div className="eyebrow">OUR COMMITMENT TO EXCELLENCE</div>
          <h2 className="section-title">WHY CHOOSE BLACK SHADES?</h2>
          <div className="gold-divider" />
          <p className="section-subtitle">
            Uniting classical sculptural mastery with modern architectural engineering.
          </p>
        </div>

        {/* 6 Feature Blocks Grid */}
        <div className={styles.featuresGrid}>
          {whyChooseData.map((item, index) => {
            const Icon = iconMap[item.icon] || Sparkles;
            return (
              <div key={item.id} className={styles.featureCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconCircle}>
                    <Icon size={24} className={styles.goldIcon} />
                  </div>
                  <span className={styles.stepNum}>0{index + 1}</span>
                </div>

                <div className={styles.cardContent}>
                  <h3 className={styles.featureTitle}>
                    {item.title} <span className={styles.featureSub}>{item.subtitle}</span>
                  </h3>
                  <p className={styles.featureDesc}>{item.description}</p>
                </div>

                <div className={styles.cardBorderAccent} />
              </div>
            );
          })}
        </div>

        {/* Bottom Impact Banner from Brochure */}
        <div className={styles.impactBanner}>
          <div className={styles.quoteBlock}>
            <Sparkles className={styles.bannerIcon} size={22} />
            <p className={styles.quoteText}>
              "WE DON'T JUST DECORATE SPACES, WE CREATE <span className="gold-text">EXPERIENCES THAT LAST."</span>
            </p>
          </div>

          <div className={styles.bannerAction}>
            <button
              type="button"
              className="btn btn-primary-gold"
              onClick={onOpenConsultation}
            >
              <MessageSquare size={16} />
              <span>Walk In For A Consultation</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
