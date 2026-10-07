import { useEffect, useRef } from 'react';

/**
 * Prevents the page behind a fixed full-screen sheet from scrolling while it's open, and closes
 * the sheet on Escape (F11 accessibility pass — every bottom sheet in the app calls this, so it's
 * the one place that gives all of them keyboard dismissal for free instead of patching each one).
 * Takes the latest `onEscape` through a ref so passing a fresh inline callback each render doesn't
 * re-run the effect (and doesn't call a stale closure either).
 */
export function useLockBodyScroll(onEscape?: () => void) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onEscapeRef.current?.();
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
