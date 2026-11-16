import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const read = () => (
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
);

/** True when the visitor has asked their device to reduce motion. Animations should then be skipped. */
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(QUERY);
    const onChange = (event) => setReduced(event.matches);
    setReduced(media.matches);
    if (media.addEventListener) {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange); // older Safari
    return () => media.removeListener(onChange);
  }, []);

  return reduced;
}
