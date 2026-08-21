import React from 'react';
import { MessageCircle } from 'lucide-react';
import styles from './WhatsAppButton.module.scss';

const WhatsAppButton = () => {
  const message = encodeURIComponent('Hello Black Shades Home Decors, I would like to discuss a project.');
  const whatsappUrl = `https://wa.me/919790838319?text=${message}`;

  return (
    <div className={styles.whatsappWrapper}>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.whatsappBtn}
        aria-label="Chat with Black Shades Home Decors on WhatsApp"
        title="Chat on WhatsApp (+91 97908 38319)"
      >
        {/* Custom SVG WhatsApp / Luxury Message Icon */}
        <div className={styles.iconBox}>
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={styles.waSvg}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>

        <div className={styles.btnLabel}>
          <span className={styles.onlineBadge} />
          <span className={styles.labelText}>Chat on WhatsApp</span>
        </div>

        {/* Outer Pulsing Ring */}
        <div className={styles.pulseRing} />
      </a>
    </div>
  );
};

export default WhatsAppButton;
