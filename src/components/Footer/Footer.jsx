import React from 'react';
import Logo from '../common/Logo';
import { Phone, Mail, MapPin, ArrowUp, QrCode, Sparkles } from 'lucide-react';
import styles from './Footer.module.scss';

const NAV_LINKS = [
  { name: 'Home', href: '#home' },
  { name: 'About Us', href: '#about' },
  { name: 'Services', href: '#services' },
  { name: 'Selected Projects', href: '#projects' },
  { name: 'Process & Method', href: '#process' },
  { name: 'Contact Us', href: '#contact' },
];

const SERVICE_LINKS = [
  'Custom Murals & Relief Walls',
  'FRP & Fiberglass Sculptures',
  'Marble Stone Powder Sculptures',
  '3D Parametric & Bespoke Designs',
  'Interior Décor & Execution',
  'Signage & Pylon Boards',
  'Commercial & Corporate Interiors',
  'Warehouse & Supermarket Solutions',
  'Concept to Completion Turnkey Projects'
];

const Footer = ({ onOpenConsultation }) => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleNavClick = (e, href) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <footer className={styles.footer}>
      {/* Top Gold Border Accent */}
      <div className={styles.topGoldBar} />

      <div className="container">
        <div className={styles.footerMainGrid}>
          {/* Column 1: Brand Info & Monogram */}
          <div className={styles.brandCol}>
            <Logo size="medium" showTagline={true} />
            
            <p className={styles.brandMission}>
              Transforming residential, commercial, and industrial spaces with custom murals, sculptures, architectural décor, and complete turnkey execution.
            </p>

            <div className={styles.brandSignature}>
              <span className={styles.sigTag}>WE DESIGN • WE SCULPT • WE CREATE</span>
            </div>

            {/* Social Channels */}
            <div className={styles.socialRow}>
              {/* Instagram */}
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.socialBtn}
                aria-label="Follow Black Shades on Instagram"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
              {/* Facebook */}
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.socialBtn}
                aria-label="Follow Black Shades on Facebook"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              {/* YouTube */}
              <a 
                href="https://youtube.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.socialBtn}
                aria-label="Follow Black Shades on YouTube"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                  <polygon points="10 15 15 12 10 9" fill="currentColor"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Navigation Links */}
          <div className={styles.navCol}>
            <h4 className={styles.colTitle}>EXPLORE</h4>
            <ul className={styles.linksList}>
              {NAV_LINKS.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href} 
                    onClick={(e) => handleNavClick(e, link.href)}
                    className={styles.footerLink}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Services Directory */}
          <div className={styles.servicesCol}>
            <h4 className={styles.colTitle}>WHAT WE DO</h4>
            <ul className={styles.linksList}>
              {SERVICE_LINKS.map((svc) => (
                <li key={svc}>
                  <a 
                    href="#services" 
                    onClick={(e) => handleNavClick(e, '#services')}
                    className={styles.footerLink}
                  >
                    {svc}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact & Brochure QR Accent */}
          <div className={styles.contactCol}>
            <h4 className={styles.colTitle}>CONTACT STUDIO</h4>
            
            <div className={styles.footerContactList}>
              <a href="tel:+919790838319" className={styles.footerContactItem}>
                <Phone size={16} className={styles.fIcon} />
                <span>+91 97908 38319</span>
              </a>

              <a href="mailto:blackshadeshomedecors@gmail.com" className={styles.footerContactItem}>
                <Mail size={16} className={styles.fIcon} />
                <span>blackshadeshomedecors@gmail.com</span>
              </a>

              <div className={styles.footerContactItem}>
                <MapPin size={16} className={styles.fIcon} />
                <span>Chennai & Surrounding Areas, Tamil Nadu</span>
              </div>
            </div>

            {/* Brochure QR Block inspired by the reference poster */}
            <div className={styles.qrCard}>
              <div className={styles.qrCodeIconBox}>
                <QrCode size={38} className={styles.qrSvg} />
              </div>
              <div className={styles.qrText}>
                <span className={styles.qrTitle}>SCAN TO VIEW</span>
                <span className={styles.qrSub}>DIGITAL PORTFOLIO</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className={styles.bottomBar}>
          <p className={styles.copyrightText}>
            © 2026 <strong>Black Shades Home Decors</strong>. All Rights Reserved.
          </p>

          <div className={styles.bottomRight}>
            <span className={styles.cityTag}>Based in Chennai, India</span>
            <button 
              type="button" 
              onClick={scrollToTop} 
              className={styles.backToTopBtn}
              aria-label="Scroll back to top"
            >
              <span>Back to Top</span>
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
