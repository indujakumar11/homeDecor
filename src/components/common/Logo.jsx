import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getLenis } from '../../lib/smoothScroll';
import styles from './Logo.module.scss';

const logoCompact = 'assets/logo/black-shades-logo-compact.webp';
const logoFull = 'assets/logo/black-shades-logo-full.webp';

const Logo = ({ size = 'medium', showTagline = false, className = '' }) => {
  const src = showTagline ? logoFull : logoCompact;
  const { pathname } = useLocation();

  // Already on the home page: a route change to "/" wouldn't re-fire
  // ScrollToTop (pathname is unchanged), so scroll to top ourselves.
  const handleClick = (e) => {
    if (pathname === '/') {
      e.preventDefault();
      getLenis()?.scrollTo(0, { duration: 1.1 });
    }
  };

  return (
    <Link
      to="/"
      onClick={handleClick}
      className={`${styles.brandLogo} ${styles[size]} ${className}`}
    >
      <img
        src={src}
        alt="Black Shades Home Decors"
        className={styles.logoImage}
      />
    </Link>
  );
};

export default Logo;
