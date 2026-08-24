import React from 'react';
import LogoMark from './LogoMark';
import styles from './Logo.module.scss';

const Logo = ({ size = 'medium', showTagline = false, className = '' }) => {
  return (
    <a href="#home" className={`${styles.brandLogo} ${styles[size]} ${className}`}>
      {/* Geometric Hexagonal BS Monogram */}
      <div className={styles.symbolWrapper}>
        <LogoMark className={styles.logoSvg} />
      </div>

      {/* Brand Typography */}
      <div className={styles.textWrapper}>
        <span className={styles.brandTitle}>BLACK SHADES</span>
        <div className={styles.subtitleRow}>
          <span className={styles.dash}></span>
          <span className={styles.brandSub}>HOME DECORS</span>
          <span className={styles.dash}></span>
        </div>
        {showTagline && (
          <span className={styles.brandTagline}>SPACES THAT INSPIRE</span>
        )}
      </div>
    </a>
  );
};

export default Logo;
