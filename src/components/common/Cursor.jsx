import { useEffect, useRef, useState } from 'react';
import styles from './Cursor.module.scss';

// Covers links, buttons, form controls, and every clickable card pattern
// used across the public site (Gallery/Services/Process cards all use
// role="button" on a div with onClick + keyboard handling).
const HOVER_TARGETS = 'a, button, [role="button"], [data-hover], input, textarea, select';
const STIFFNESS = 0.12;
const DAMPING = 0.75;

// Two-layer custom cursor: a dot that tracks the mouse instantly and a ring
// that trails behind it with spring physics. Positions are written directly
// to refs' style (transform, not left/top, so this never triggers layout —
// only compositing) via rAF, not React state, so the 60fps loop never
// triggers a re-render.
//
// Shown only on devices that report a real mouse-like pointer
// ((hover: hover) and (pointer: fine)) — not merely "non-touch" — so a
// touchscreen laptop with a mouse attached still gets it, and a touch-only
// phone/tablet never does. Checked once at mount; this is a UX overlay, not
// something that needs to react to a pointer being hot-plugged mid-session.
//
// When the OS-level prefers-reduced-motion is set, the ring's spring/rAF
// trailing loop is skipped entirely — it tracks the pointer directly, same
// as the dot, with no lag and no continuous per-frame animation.
const Cursor = () => {
  const [shouldRender] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (!shouldRender) return undefined;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return undefined;

    const prefersReducedMotion = Boolean(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let ringVX = 0;
    let ringVY = 0;
    let rafId;

    const setRingPosition = (x, y) => {
      ring.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;

      if (prefersReducedMotion) {
        ringX = mouseX;
        ringY = mouseY;
        setRingPosition(ringX, ringY);
      }
    };

    const animateRing = () => {
      const dx = mouseX - ringX;
      const dy = mouseY - ringY;

      ringVX = ringVX * DAMPING + dx * STIFFNESS;
      ringVY = ringVY * DAMPING + dy * STIFFNESS;

      ringX += ringVX;
      ringY += ringVY;

      setRingPosition(ringX, ringY);

      rafId = requestAnimationFrame(animateRing);
    };

    const handleMouseOver = (e) => {
      if (e.target.closest(HOVER_TARGETS)) {
        document.body.classList.add('cursor-hover');
      }
    };
    const handleMouseOut = (e) => {
      if (e.target.closest(HOVER_TARGETS)) {
        document.body.classList.remove('cursor-hover');
      }
    };
    const handleMouseLeave = () => { dot.parentElement.style.opacity = '0'; };
    const handleMouseEnter = () => { dot.parentElement.style.opacity = '1'; };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    // Reduced motion: no spring loop at all — position is set directly in
    // handleMouseMove above, so there's nothing for rAF to animate.
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(animateRing);
    }
    document.body.classList.add('has-custom-cursor');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (rafId) cancelAnimationFrame(rafId);
      document.body.classList.remove('has-custom-cursor', 'cursor-hover');
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div className={styles.cursor} aria-hidden="true">
      <div ref={dotRef} className={styles.cursorDot} />
      <div ref={ringRef} className={styles.cursorRing} />
    </div>
  );
};

export default Cursor;
