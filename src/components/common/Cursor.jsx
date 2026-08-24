import { useEffect, useRef } from 'react';
import { Pointer } from 'lucide-react';
import styles from './Cursor.module.scss';

const HOVER_TARGETS = 'a, button, [data-hover], input, textarea, select';
const HAND_TARGETS = '[data-cursor="hand"]';
const STIFFNESS = 0.12;
const DAMPING = 0.75;

// Two-layer custom cursor: a dot that tracks the mouse instantly and a ring
// that trails behind it with spring physics. Positions are written directly
// to refs' style via rAF (not React state) so the 60fps loop never triggers
// a re-render. Skipped entirely on touch devices.
const Cursor = () => {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const handRef = useRef(null);

  useEffect(() => {
    if ('ontouchstart' in window) return undefined;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const hand = handRef.current;
    if (!dot || !ring || !hand) return undefined;

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let ringVX = 0;
    let ringVY = 0;
    let rafId;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
      hand.style.left = `${mouseX}px`;
      hand.style.top = `${mouseY}px`;
    };

    const animateRing = () => {
      const dx = mouseX - ringX;
      const dy = mouseY - ringY;

      ringVX = ringVX * DAMPING + dx * STIFFNESS;
      ringVY = ringVY * DAMPING + dy * STIFFNESS;

      ringX += ringVX;
      ringY += ringVY;

      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;

      rafId = requestAnimationFrame(animateRing);
    };

    const handleMouseOver = (e) => {
      if (e.target.closest(HAND_TARGETS)) {
        document.body.classList.add('cursor-hand');
      } else if (e.target.closest(HOVER_TARGETS)) {
        document.body.classList.add('cursor-hover');
      }
    };
    const handleMouseOut = (e) => {
      if (e.target.closest(HAND_TARGETS)) {
        document.body.classList.remove('cursor-hand');
      } else if (e.target.closest(HOVER_TARGETS)) {
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
    rafId = requestAnimationFrame(animateRing);
    document.body.classList.add('has-custom-cursor');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(rafId);
      document.body.classList.remove('has-custom-cursor', 'cursor-hover', 'cursor-hand');
    };
  }, []);

  return (
    <div className={styles.cursor} aria-hidden="true">
      <div ref={dotRef} className={styles.cursorDot} />
      <div ref={ringRef} className={styles.cursorRing} />
      <div ref={handRef} className={styles.cursorHand}>
        <Pointer size={26} strokeWidth={1.75} />
      </div>
    </div>
  );
};

export default Cursor;
