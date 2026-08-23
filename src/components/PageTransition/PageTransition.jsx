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
      gsap.fromTo(
        scope.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }
      );
    });
    return () => mm.revert();
  }, { scope, dependencies: [pathname] });

  return <div ref={scope}>{children}</div>;
};

export default PageTransition;
