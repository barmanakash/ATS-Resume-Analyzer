import { useEffect, useRef, useState } from 'react';

/**
 * Tells you when an element has scrolled into view. Attach `ref` to the element.
 * With `once` (the default) it stays true after the first time, so content does not flicker on scroll back.
 * Where IntersectionObserver does not exist (old browsers, tests) it reports true so nothing stays hidden.
 */
export default function useInView({ threshold = 0.15, rootMargin = '0px 0px -8% 0px', once = true } = {}) {
  const ref = useRef(null);
  const supported = typeof IntersectionObserver !== 'undefined';
  const [inView, setInView] = useState(!supported);

  useEffect(() => {
    const node = ref.current;
    if (!supported || !node) {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [supported, threshold, rootMargin, once]);

  return [ref, inView];
}
