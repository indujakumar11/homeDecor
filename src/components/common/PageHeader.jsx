import React from 'react';
import styles from './PageHeader.module.scss';

const PageHeader = ({ title, subtitle, eyebrow }) => {
  return (
    <section className={styles.pageHeader}>
      <div className="grid-bg-overlay" />
      <div className={styles.headerOverlay} />
      <div className={`container ${styles.headerContainer}`}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className={styles.title}>
          {title.split(' ').map((word, i) => {
            const isLast = i === title.split(' ').length - 1;
            return (
              <span key={i} className={isLast ? 'gold-text' : ''}>
                {word}{' '}
              </span>
            );
          })}
        </h1>
        <div className="gold-divider" />
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    </section>
  );
};

export default PageHeader;
