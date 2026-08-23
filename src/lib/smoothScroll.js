import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;
let tickFn = null;

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createLenis() {
  if (lenisInstance) return lenisInstance;
  if (prefersReducedMotion()) return null;

  lenisInstance = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    autoRaf: false,
  });

  lenisInstance.on('scroll', ScrollTrigger.update);

  tickFn = (time) => lenisInstance.raf(time * 1000);
  gsap.ticker.add(tickFn);
  gsap.ticker.lagSmoothing(0);

  return lenisInstance;
}

export function getLenis() {
  return lenisInstance;
}

export function destroyLenis() {
  if (!lenisInstance) return;
  gsap.ticker.remove(tickFn);
  lenisInstance.destroy();
  lenisInstance = null;
  tickFn = null;
}

export function refreshScrollTrigger() {
  ScrollTrigger.refresh();
}

export { gsap, ScrollTrigger };
