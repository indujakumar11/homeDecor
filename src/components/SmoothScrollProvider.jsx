import { useEffect } from 'react';
import { createLenis, destroyLenis } from '../lib/smoothScroll';

const SmoothScrollProvider = () => {
  useEffect(() => {
    createLenis();
    return () => {
      destroyLenis();
    };
  }, []);

  return null;
};

export default SmoothScrollProvider;
