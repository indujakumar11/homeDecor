import React from 'react';
import { Compass, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { trustStripData } from '../../data/trustStripData';
import styles from './TrustStrip.module.scss';

const iconMap = {
  Compass: Compass,
  ShieldCheck: ShieldCheck,
  Sparkles: Sparkles,
  Layers: Layers
};

const TrustStrip = () => {
  return (
    <section id="trust-strip" className={styles.trustSection}>
      <div className="container">
        {/* Four Core Pillars */}
        <div className={styles.trustGrid}>
          {trustStripData.map((item, index) => {
            const IconComponent = iconMap[item.icon] || Sparkles;
            return (
              <div key={item.id} className={styles.trustItem}>
                <div className={styles.iconBox}>
                  <IconComponent size={22} className={styles.trustIcon} />
                </div>
                <div className={styles.textBox}>
                  <h2 className={styles.itemTitle}>{item.title}</h2>
                  <p className={styles.itemSubtitle}>{item.subtitle}</p>
                </div>
                {index < trustStripData.length - 1 && (
                  <div className={styles.verticalDivider} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>

        {/* Brand Banner Ribbon inspired by reference brochure */}
        <div className={styles.brandRibbon}>
          <div className={styles.ribbonBorder}>
            <span className={styles.ribbonMain}>ONE VISION. ONE PARTNER. COMPLETE SOLUTIONS.</span>
            <span className={styles.ribbonDot}>•</span>
            <span className={styles.ribbonSub}>FOR HOMES, OFFICES, COMMERCIAL & INDUSTRIAL SPACES</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustStrip;
