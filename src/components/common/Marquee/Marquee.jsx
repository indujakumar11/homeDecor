import React from 'react';
import styles from './Marquee.module.scss';

const DEFAULT_ITEMS = [
  'CUSTOM MURALS & RELIEF',
  'FRP & FIBERGLASS SCULPTURES',
  'MARBLE STONE POWDER ART',
  '3D PARAMETRIC DESIGN',
  'INTERIOR DÉCOR & EXECUTION',
  'SIGNAGE & PYLONS',
  'TURNKEY PROJECTS',
];

const Marquee = ({ items = DEFAULT_ITEMS }) => {
  const track = (
    <div className={styles.track}>
      {items.map((item, idx) => (
        <span className={styles.item} key={idx}>
          {item}
          <span className={styles.dot} aria-hidden="true">✦</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.trackWrapper}>
        {track}
        {track}
      </div>
    </div>
  );
};

export default Marquee;
