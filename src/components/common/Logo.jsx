import React from 'react';
import styles from './Logo.module.scss';

const Logo = ({ size = 'medium', showTagline = false, className = '' }) => {
  return (
    <a href="#home" className={`${styles.brandLogo} ${styles[size]} ${className}`} aria-label="Black Shades Home Decors Home">
      {/* Geometric Hexagonal BS Monogram */}
      <div className={styles.symbolWrapper}>
        <svg viewBox="0 0 100 100" className={styles.logoSvg} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f7e1a9" />
              <stop offset="35%" stopColor="#d4af63" />
              <stop offset="70%" stopColor="#b58a3c" />
              <stop offset="100%" stopColor="#7a5a1f" />
            </linearGradient>
            <linearGradient id="goldLightGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8c6827" />
              <stop offset="50%" stopColor="#eccb7e" />
              <stop offset="100%" stopColor="#c49a46" />
            </linearGradient>
          </defs>
          
          {/* Hexagonal Outer Frame Accent */}
          <polygon 
            points="50,4 92,26 92,74 50,96 8,74 8,26" 
            stroke="url(#goldGradient)" 
            strokeWidth="2.5" 
            strokeOpacity="0.35"
            fill="#0f0e0d"
          />
          
          {/* Interlocking Stylized B and S Monogram */}
          <path 
            d="M28 20 H52 C60 20 66 25 66 33 C66 40 60 45 52 46 C62 47 68 53 68 62 C68 72 60 78 48 78 H28 V20 Z" 
            stroke="url(#goldGradient)" 
            strokeWidth="5" 
            strokeLinejoin="bevel"
            fill="none"
          />
          {/* Central B Bar */}
          <path d="M28 46 H52" stroke="url(#goldGradient)" strokeWidth="5" strokeLinecap="square"/>

          {/* S Geometric Overlay Slice */}
          <path 
            d="M62 25 L76 33 V42 L56 52 H68 C76 52 82 58 82 66 C82 76 74 80 62 80 L44 80" 
            stroke="url(#goldLightGrad)" 
            strokeWidth="4" 
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.85"
          />
        </svg>
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
