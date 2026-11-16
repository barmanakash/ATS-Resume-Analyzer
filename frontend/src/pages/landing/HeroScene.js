import React, { useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import useCountUp from '../../hooks/useCountUp';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { scanDelaySeconds } from '../../utils/motion';

/**
 * Decorative hero illustration: a sample resume is scanned, matches and gaps light up, and an example
 * score counts up. It is an illustration only, so it is hidden from assistive technology.
 *
 * Everything loops on one 7 second cycle. The scan line sweeps down during the first ~3.8 seconds and each
 * highlight/badge is delayed so it appears just as the line reaches it. With reduced motion the animations
 * are switched off and the finished state (highlights and badges visible) is shown.
 */

const CYCLE = '7s';
const SHEET_HEIGHT = 400;
const EXAMPLE_SCORE = 74;

const scan = keyframes`
  0%   { transform: translateY(12px); opacity: 0; }
  4%   { opacity: 1; }
  54%  { transform: translateY(388px); opacity: 1; }
  58%  { transform: translateY(388px); opacity: 0; }
  100% { transform: translateY(388px); opacity: 0; }
`;
const highlight = keyframes`
  0%   { background-color: #e5e7eb; }
  3%   { background-color: var(--hl); }
  86%  { background-color: var(--hl); }
  100% { background-color: #e5e7eb; }
`;
const popIn = keyframes`
  0%   { opacity: 0; transform: translateY(10px) scale(0.85); }
  4%   { opacity: 1; transform: translateY(0) scale(1); }
  86%  { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(0) scale(0.95); }
`;
const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
`;

const HIGHLIGHTS = { good: '#bbf7d0', warn: '#fde68a', bad: '#fecaca' };
const BASE_BAR = '#e5e7eb';

// Rows of the sample resume. `top` is in pixels, `w` is a percentage of the text width.
const ROWS = [
  { top: 24, w: 44, h: 14, tone: 'dark' },
  { top: 46, w: 62, h: 8 },
  { top: 80, w: 20, h: 8, tone: 'accent' },
  { top: 98, w: 92, h: 8 },
  { top: 112, w: 78, h: 8 },
  { top: 144, w: 26, h: 8, tone: 'accent' },
  { top: 162, w: 88, h: 8, hl: 'good' },
  { top: 176, w: 70, h: 8 },
  { top: 190, w: 82, h: 8, hl: 'good' },
  { top: 204, w: 60, h: 8 },
  { top: 236, w: 18, h: 8, tone: 'accent' },
  { top: 254, w: 66, h: 8, hl: 'warn' },
  { top: 268, w: 50, h: 8 },
  { top: 292, w: 56, h: 8, hl: 'bad', dashed: true },
  { top: 324, w: 24, h: 8, tone: 'accent' },
  { top: 342, w: 74, h: 8 },
  { top: 356, w: 40, h: 8 },
];

const BADGES = [
  { skill: 'Python', status: 'matched', color: 'success.main', rowTop: 162, right: -30 },
  { skill: 'Docker', status: 'matched', color: 'success.main', rowTop: 190, right: -12 },
  { skill: 'AWS', status: 'partial match', color: 'warning.main', rowTop: 254, right: -34 },
  { skill: 'Kubernetes', status: 'not found', color: 'error.main', rowTop: 292, right: -18 },
];

const delayFor = (rowTop) => Math.max(0, scanDelaySeconds((rowTop / SHEET_HEIGHT) * 100, { height: SHEET_HEIGHT }) - 0.05);

const noMotion = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

function barColor(row) {
  if (row.tone === 'dark') return '#9ca3af';
  if (row.tone === 'accent') return 'rgba(30, 79, 216, 0.55)';
  return BASE_BAR;
}

function ResumeRow({ row }) {
  const hlColor = row.hl ? HIGHLIGHTS[row.hl] : null;
  return (
    <Box
      sx={{
        position: 'absolute',
        top: row.top,
        left: 24,
        width: `calc((100% - 48px) * ${row.w / 100})`,
        height: row.h,
        borderRadius: 1,
        backgroundColor: hlColor || barColor(row),
        ...(row.dashed && { outline: '1.5px dashed #f87171', outlineOffset: 2 }),
        ...(hlColor && {
          '--hl': hlColor,
          animation: `${highlight} ${CYCLE} linear ${delayFor(row.top)}s infinite backwards`,
          ...noMotion,
        }),
      }}
    />
  );
}

function Badge({ badge, index }) {
  const delay = delayFor(badge.rowTop);
  return (
    <Box
      sx={{
        position: 'absolute',
        top: badge.rowTop - 10,
        right: badge.right,
        zIndex: 3,
        animation: `${popIn} ${CYCLE} cubic-bezier(0.2, 0.7, 0.2, 1) ${delay}s infinite backwards`,
        ...noMotion,
      }}
    >
      <Box sx={{ animation: `${float} ${5 + index}s ease-in-out ${index * 0.4}s infinite`, ...noMotion }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 5,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: badge.color,
            boxShadow: '0 6px 16px rgba(17, 24, 39, 0.12)',
            whiteSpace: 'nowrap',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': { boxShadow: '0 10px 22px rgba(17, 24, 39, 0.18)' },
            '@media (prefers-reduced-motion: no-preference)': { '&:hover': { transform: 'scale(1.08)' } },
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: badge.color, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{badge.skill}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{badge.status}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function ScoreCard() {
  const score = useCountUp(EXAMPLE_SCORE, { delay: 600, duration: 1800 });
  return (
    <Box
      sx={{
        position: 'absolute',
        left: { xs: 0, sm: -22 },
        bottom: -38,
        zIndex: 4,
        animation: `${float} 6s ease-in-out infinite`,
        ...noMotion,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          pr: 2.5,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: '0 14px 34px rgba(17, 24, 39, 0.16)',
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress variant="determinate" value={100} size={64} thickness={5} sx={{ color: 'divider' }} />
          <CircularProgress variant="determinate" value={score} size={64} thickness={5} sx={{ position: 'absolute', left: 0 }} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{score}</Typography>
          </Box>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>Example match</Typography>
          <Typography variant="caption" color="text.secondary">Illustration only</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function HeroScene() {
  const sceneRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  // A gentle 3D tilt that follows the pointer.
  const handleMove = (event) => {
    if (reduced || !sceneRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    sceneRef.current.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
  };
  const handleLeave = () => {
    if (sceneRef.current) sceneRef.current.style.transform = '';
  };

  return (
    <Box
      aria-hidden="true"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      sx={{ position: 'relative', width: '100%', maxWidth: 400, mx: 'auto', height: SHEET_HEIGHT + 56, pt: 1 }}
    >
      <Box
        ref={sceneRef}
        sx={{ position: 'relative', height: SHEET_HEIGHT, transition: 'transform 0.25s ease-out', transformStyle: 'preserve-3d' }}
      >
        {/* Sheet behind, for depth */}
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: 4, bgcolor: '#e0e7ff', transform: 'rotate(-5deg) translate(-14px, 10px)' }} />

        {/* The resume */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            borderRadius: 4,
            bgcolor: '#ffffff',
            border: 1,
            borderColor: 'divider',
            boxShadow: '0 28px 60px rgba(30, 79, 216, 0.16), 0 2px 6px rgba(17, 24, 39, 0.06)',
          }}
        >
          {ROWS.map((row) => <ResumeRow key={row.top} row={row} />)}

          {/* Scan line */}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 3,
              zIndex: 2,
              background: 'linear-gradient(90deg, transparent, #1e4fd8 20%, #4d78e6 80%, transparent)',
              boxShadow: '0 0 16px 4px rgba(30, 79, 216, 0.28)',
              animation: `${scan} ${CYCLE} linear infinite`,
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 3,
                height: 40,
                background: 'linear-gradient(to top, rgba(30, 79, 216, 0.14), transparent)',
              },
              '@media (prefers-reduced-motion: reduce)': { display: 'none' },
            }}
          />
        </Box>

        {BADGES.map((badge, index) => <Badge key={badge.skill} badge={badge} index={index} />)}
        <ScoreCard />
      </Box>
    </Box>
  );
}
