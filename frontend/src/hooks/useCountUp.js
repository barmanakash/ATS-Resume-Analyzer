import { useEffect, useState } from 'react';
import usePrefersReducedMotion from './usePrefersReducedMotion';
import { countValue } from '../utils/motion';

/** Counts a number up from 0 to `target` once `start` becomes true. Jumps straight to the target if motion is reduced. */
export default function useCountUp(target, { start = true, duration = 1600, delay = 0 } = {}) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);

  useEffect(() => {
    if (!start) return undefined;
    if (reduced) {
      setValue(target);
      return undefined;
    }
    let frame;
    const timer = setTimeout(() => {
      const startedAt = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        setValue(countValue(target, progress));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [start, target, duration, delay, reduced]);

  return value;
}
