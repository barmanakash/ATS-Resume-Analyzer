/** Small pure helpers for animation timing. Kept free of React so they are easy to test. */

export const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Starts fast and settles gently. Used for count-up numbers. */
export const easeOutCubic = (progress) => 1 - (1 - clamp01(progress)) ** 3;

/** The whole number to show when an animation toward `target` is `progress` (0 to 1) complete. */
export const countValue = (target, progress) => Math.round(target * easeOutCubic(progress));

/**
 * Seconds into the scan animation at which the scan line reaches a point `percent` of the way down the page.
 * The line travels from `start` to `end` (pixels) over `sweep` seconds, on a sheet `height` pixels tall.
 */
export function scanDelaySeconds(percent, { height = 400, start = 12, end = 388, sweep = 3.78 } = {}) {
  const y = (clamp01(percent / 100)) * height;
  return clamp01((y - start) / (end - start)) * sweep;
}
