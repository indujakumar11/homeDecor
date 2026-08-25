import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../lib/smoothScroll';

const PageTransition = ({ children }) => {
  const { pathname } = useLocation();
  const scope = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // clearProps removes the inline transform once the tween finishes —
      // otherwise it lingers at translate3d(0,0,0) and (since any transform
      // creates a new containing block) breaks every position:fixed element
      // nested in routed page content, e.g. the Services/Gallery modals
      // landing far down the page instead of covering the viewport.
      gsap.fromTo(
        scope.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', clearProps: 'transform' }
      );
    });
    return () => mm.revert();
  }, { scope, dependencies: [pathname] });

  return <div ref={scope}>{children}</div>;
};

export default PageTransition;
