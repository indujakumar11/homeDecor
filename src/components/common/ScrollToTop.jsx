import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getLenis, refreshScrollTrigger } from '../../lib/smoothScroll';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }

    const id = requestAnimationFrame(() => refreshScrollTrigger());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
