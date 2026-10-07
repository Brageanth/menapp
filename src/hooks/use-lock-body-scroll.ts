import { useEffect } from 'react';

/** Prevents the page behind a fixed full-screen sheet from scrolling while it's open. */
export function useLockBodyScroll() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}
