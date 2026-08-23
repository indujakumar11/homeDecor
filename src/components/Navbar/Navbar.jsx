import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import Logo from '../common/Logo';
import { Menu, X, Phone, Calendar, ArrowRight } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { gsap, getLenis } from '../../lib/smoothScroll';
import { lockScroll, unlockScroll } from '../../lib/scrollLock';
import styles from './Navbar.module.scss';

const NAV_LINKS = [
  { name: 'HOME', href: '/' },
  { name: 'ABOUT', href: '/about' },
  { name: 'SERVICES', href: '/services' },
  { name: 'PROJECTS', href: '/projects' },
  { name: 'PROCESS', href: '/process' },
  { name: 'CONTACT', href: '/contact' },
];

const Navbar = ({ onOpenConsultation }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const drawerListRef = useRef(null);
  // Tracks whether *this* effect is the one currently holding the shared
  // scroll lock, so its mount-time run (drawer starts closed) never
  // releases a lock some other holder (e.g. the Preloader) still needs.
  const holdsLockRef = useRef(false);

  // Stagger-in mobile drawer links each time the drawer opens
  useGSAP(() => {
    if (!mobileMenuOpen || !drawerListRef.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        drawerListRef.current.children,
        { opacity: 0, x: 24 },
        { opacity: 1, x: 0, duration: 0.45, stagger: 0.06, delay: 0.15, ease: 'power2.out' }
      );
    });
    return () => mm.revert();
  }, { dependencies: [mobileMenuOpen], scope: drawerListRef });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    const lenis = getLenis();
    if (mobileMenuOpen) {
      lockScroll();
      holdsLockRef.current = true;
      lenis?.stop();
    } else if (holdsLockRef.current) {
      unlockScroll();
      holdsLockRef.current = false;
      lenis?.start();
    }

    return () => {
      if (holdsLockRef.current) {
        unlockScroll();
        holdsLockRef.current = false;
      }
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header ref={headerRef} className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
        <div className={`container ${styles.navContainer}`}>
          {/* Brand Monogram & Title */}
          <Logo size="small" />

          {/* Desktop Navigation Links */}
          <nav className={styles.desktopNav} aria-label="Main Navigation">
            <ul className={styles.navList}>
              {NAV_LINKS.map((link) => (
                <li key={link.name} className={styles.navItem}>
                  <NavLink
                    to={link.href}
                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                  >
                    {link.name}
                    <span className={styles.navIndicator}></span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Header Action CTA */}
          <div className={styles.navActions}>
            <a 
              href="tel:+919790838319" 
              className={styles.phoneQuickLink} 
              aria-label="Call Black Shades at +91 97908 38319"
              title="Call Us Directly"
            >
              <Phone size={15} className={styles.phoneIcon} />
            </a>

            <button
              type="button"
              className={`btn btn-primary-gold ${styles.consultationBtn}`}
              onClick={onOpenConsultation}
            >
              <Calendar size={14} />
              <span>BOOK A CONSULTATION</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className={styles.mobileToggle}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <div 
        className={`${styles.mobileBackdrop} ${mobileMenuOpen ? styles.open : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <div className={`${styles.mobileDrawer} ${mobileMenuOpen ? styles.open : ''}`}>
        <div className={styles.drawerHeader}>
          <Logo size="small" />
          <button 
            className={styles.closeDrawerBtn} 
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <div className={styles.drawerContent}>
          <p className={styles.drawerTagline}>WE DESIGN • WE SCULPT • WE CREATE</p>
          <ul ref={drawerListRef} className={styles.mobileNavList}>
            {NAV_LINKS.map((link) => (
              <li key={link.name}>
                <NavLink
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `${styles.mobileNavLink} ${isActive ? styles.mobileActive : ''}`}
                >
                  <span>{link.name}</span>
                  <ArrowRight size={16} className={styles.mobileArrow} />
                </NavLink>
              </li>
            ))}
          </ul>

          <div className={styles.drawerFooter}>
            <button
              type="button"
              className="btn btn-primary-gold"
              style={{ width: '100%' }}
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenConsultation();
              }}
            >
              <Calendar size={16} />
              <span>BOOK A CONSULTATION</span>
            </button>

            <a
              href="tel:+919790838319"
              className={styles.drawerPhone}
              aria-label="Call Black Shades at +91 97908 38319"
            >
              <Phone size={16} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
