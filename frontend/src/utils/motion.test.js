import { clamp01, countValue, easeOutCubic, scanDelaySeconds } from './motion';

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('moves fast at first and slows down', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.9) - easeOutCubic(0.8)).toBeLessThan(easeOutCubic(0.2) - easeOutCubic(0.1));
  });

  it('ignores progress outside 0 to 1', () => {
    expect(easeOutCubic(-3)).toBe(0);
    expect(easeOutCubic(7)).toBe(1);
  });
});

describe('countValue', () => {
  it('counts from 0 up to exactly the target', () => {
    expect(countValue(74, 0)).toBe(0);
    expect(countValue(74, 1)).toBe(74);
  });

  it('only ever rises and never overshoots', () => {
    let previous = -1;
    for (let step = 0; step <= 20; step += 1) {
      const value = countValue(74, step / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(74);
      previous = value;
    }
  });

  it('returns whole numbers', () => {
    expect(Number.isInteger(countValue(74, 0.37))).toBe(true);
  });
});

describe('clamp01', () => {
  it('keeps values within 0 and 1', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});

describe('scanDelaySeconds', () => {
  it('is 0 at the top and the full sweep time at the bottom', () => {
    expect(scanDelaySeconds(0)).toBe(0);
    expect(scanDelaySeconds(100)).toBeCloseTo(3.78, 5);
  });

  it('grows the further down the page a row is', () => {
    const rows = [10, 25, 40, 60, 80].map((percent) => scanDelaySeconds(percent));
    rows.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(rows[index]));
  });

  it('matches where the scan line is on a 400px sheet (line at 200px is about halfway)', () => {
    expect(scanDelaySeconds(50)).toBeCloseTo(((200 - 12) / (388 - 12)) * 3.78, 5);
  });
});
