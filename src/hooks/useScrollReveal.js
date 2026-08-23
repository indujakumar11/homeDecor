import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/smoothScroll';

// Thin wrapper around a common useGSAP fade-up-on-scroll pattern.
// Pass `selector` to stagger-reveal a group of children instead of the whole scope.
export function useScrollReveal({ selector = null, y = 40, stagger = 0.12, start = 'top 82%' } = {}) {
  const scope = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = selector ? scope.current.querySelectorAll(selector) : scope.current;
      if (!targets || (targets.length === 0 && selector)) return;

      gsap.fromTo(
        targets,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger,
          scrollTrigger: {
            trigger: scope.current,
            start,
          },
        }
      );
    });

    return () => mm.revert();
  }, { scope });

  return scope;
}
