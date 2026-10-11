import React, { useState, useEffect, useRef, useId } from 'react';
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

const HIDE_THRESHOLD = 120; // px — stay visible until scrolled past this, regardless of direction
const HIDE_DELTA = 4; // px — ignore sub-pixel/inertia jitter when deciding direction

// Keyboard-reachable controls inside the drawer, in DOM order.
const getFocusable = (root) =>
  [...root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(
    (el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0
  );

const Navbar = ({ onOpenConsultation }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const drawerListRef = useRef(null);
  const lastScrollYRef = useRef(0);
  // Tracks whether *this* effect is the one currently holding the shared
  // scroll lock, so its mount-time run (drawer starts closed) never
  // releases a lock some other holder (e.g. the Preloader) still needs.
  const holdsLockRef = useRef(false);
  const drawerRef = useRef(null);
  const toggleRef = useRef(null);
  const drawerId = useId();

  // Mobile drawer keyboard behaviour. The open drawer is modal (its backdrop
  // covers the whole page, header included, and page scroll is locked), so
  // focus moves to the first link, Tab/Shift+Tab stay inside, and Escape
  // closes. However it closes — Escape, X, backdrop, a link, the consultation
  // button — focus goes back to the toggle, if it was in the drawer (or lost)
  // and the toggle is showing. The closed drawer is `inert` (see JSX).
  useEffect(() => {
    if (!mobileMenuOpen || !drawerRef.current) return undefined;
    const drawer = drawerRef.current;
    const toggle = toggleRef.current;
    drawerListRef.current?.querySelector('a')?.focus({ preventScroll: true });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(drawer);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = drawer.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const active = document.activeElement;
      const focusWasInMenu = !active || active === document.body || drawer.contains(active);
      if (focusWasInMenu && toggle?.isConnected && toggle.getClientRects().length > 0) {
        toggle.focus({ preventScroll: true });
      }
    };
  }, [mobileMenuOpen]);

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
      const currentY = window.scrollY;
      setIsScrolled(currentY > 40);

      // Auto-hide on scroll down, reveal on scroll up. Stay visible near the
      // top so the header doesn't disappear on a small initial scroll.
      if (mobileMenuOpen || currentY <= HIDE_THRESHOLD) {
        setIsHidden(false);
      } else if (currentY > lastScrollYRef.current + HIDE_DELTA) {
        setIsHidden(true);
      } else if (currentY < lastScrollYRef.current - HIDE_DELTA) {
        setIsHidden(false);
      }
      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileMenuOpen]);

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
        getLenis()?.start();
      }
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header ref={headerRef} className={`${styles.header} ${isScrolled ? styles.scrolled : ''} ${isHidden ? styles.hidden : ''}`}>
        <div className={`container ${styles.navContainer}`}>
          {/* Brand Monogram & Title */}
          <Logo size="small" showTagline />

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
              ref={toggleRef}
              type="button"
              className={styles.mobileToggle}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls={drawerId}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
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
      <div
        ref={drawerRef}
        id={drawerId}
        className={`${styles.mobileDrawer} ${mobileMenuOpen ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        // Closed: out of the Tab order and the accessibility tree (it's only
        // moved off-screen visually).
        inert={!mobileMenuOpen}
      >
        <div className={styles.drawerHeader}>
          <Logo size="small" showTagline />
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
