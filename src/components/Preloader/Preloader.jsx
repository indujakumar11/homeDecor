import React, { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, getLenis, prefersReducedMotion } from '../../lib/smoothScroll';
import { shouldShowPreloader, markPreloaderComplete } from '../../lib/preloaderSignal';
import { lockScroll, unlockScroll as unlockScrollShared } from '../../lib/scrollLock';
import LogoMark from '../common/LogoMark';
import styles from './Preloader.module.scss';

const HERO_IMAGE_SRC = 'assets/hero/hero-bg.jpg';
const MAX_EXTRA_WAIT = 500; // ms — hard cap on top of the intro if the hero image is slow/broken

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Plays once per browser tab session (see lib/preloaderSignal.js) before
// Hero's own entrance timeline runs. Locks scroll (body + Lenis) while
// active and restores it once the reveal wipe finishes.
const Preloader = () => {
  const [shouldRender] = useState(() => shouldShowPreloader());
  const [finished, setFinished] = useState(false);
  const overlayRef = useRef(null);
  const logoWrapRef = useRef(null);
  const percentRef = useRef(null);
  const lineFillRef = useRef(null);

  useGSAP(() => {
    if (!shouldRender) return;

    const lenis = getLenis();
    lenis?.stop();
    lockScroll();

    const unlockScroll = () => {
      getLenis()?.start();
      unlockScrollShared();
    };

    if (prefersReducedMotion()) {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.25,
        delay: 0.1,
        onComplete: () => {
          markPreloaderComplete();
          unlockScroll();
          setFinished(true);
        },
      });
      return () => {
        unlockScroll();
      };
    }

    const startReveal = () => {
      const revealTl = gsap.timeline();
      revealTl
        .to(logoWrapRef.current, { scale: 1.04, duration: 0.15, ease: 'power1.inOut' })
        .to(logoWrapRef.current, { scale: 1, duration: 0.2, ease: 'power2.out' })
        .addLabel('reveal', '+=0.1')
        .call(() => markPreloaderComplete(), null, 'reveal-=0.2')
        .to(overlayRef.current, {
          yPercent: -100,
          duration: 0.7,
          ease: 'power4.inOut',
          onComplete: () => {
            unlockScroll();
            setFinished(true);
          },
        }, 'reveal');
    };

    const counter = { value: 0 };
    const introTl = gsap.timeline({
      onComplete: () => {
        Promise.race([preloadImage(HERO_IMAGE_SRC), waitMs(MAX_EXTRA_WAIT)]).then(startReveal);
      },
    });

    introTl
      .from(logoWrapRef.current, { opacity: 0, scale: 0.92, duration: 0.5, ease: 'power2.out' }, 0)
      .to(counter, {
        value: 100,
        duration: 1.1,
        ease: 'power1.inOut',
        onUpdate: () => {
          if (percentRef.current) {
            percentRef.current.textContent = `${Math.round(counter.value)}%`;
          }
        },
      }, 0.2)
      .to(lineFillRef.current, { scaleX: 1, duration: 1.1, ease: 'power1.inOut' }, 0.2);

    return () => {
      unlockScroll();
    };
  }, { scope: overlayRef, dependencies: [shouldRender] });

  if (!shouldRender || finished) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="status"
      aria-label="Loading Black Shades Home Decors"
    >
      <div className={styles.glow} aria-hidden="true" />

      <div ref={logoWrapRef} className={styles.brandBlock}>
        <div className={styles.markWrap}>
          <LogoMark className={styles.mark} />
        </div>
        <div className={styles.wordmark}>
          <span className={styles.title}>BLACK SHADES</span>
          <div className={styles.subtitleRow}>
            <span className={styles.dash} aria-hidden="true" />
            <span className={styles.sub}>HOME DECORS</span>
            <span className={styles.dash} aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className={styles.progressBlock} aria-hidden="true">
        <span ref={percentRef} className={styles.percent}>0%</span>
        <div className={styles.lineTrack}>
          <div ref={lineFillRef} className={styles.lineFill} />
        </div>
      </div>
    </div>
  );
};

export default Preloader;
