import React from 'react';
import { Box } from '@mui/material';
import useInView from '../../hooks/useInView';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

const OFFSETS = {
  up: (d) => `translate3d(0, ${d}px, 0)`,
  down: (d) => `translate3d(0, -${d}px, 0)`,
  left: (d) => `translate3d(${d}px, 0, 0)`, // slides in from the right
  right: (d) => `translate3d(-${d}px, 0, 0)`, // slides in from the left
  none: () => 'none',
};

/**
 * Fades and slides its content in the first time it scrolls into view.
 * `delay` (ms) lets neighbouring items arrive one after another.
 * With reduced motion it simply shows the content.
 */
export default function Reveal({
  children, delay = 0, direction = 'up', distance = 28, duration = 650, sx, ...rest
}) {
  const [ref, inView] = useInView();
  const reduced = usePrefersReducedMotion();
  const visible = inView || reduced;

  return (
    <Box
      ref={ref}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : (OFFSETS[direction] || OFFSETS.up)(distance),
        transition: reduced
          ? 'none'
          : `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delay}ms`,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
