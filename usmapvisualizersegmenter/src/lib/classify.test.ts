import { describe, expect, it } from 'vitest';
import { classify, formatNumber, PALETTES } from './classify';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('classify', () => {
  it('quantile classes hold about the same number of values', () => {
    const result = classify(range(100), 'quantile', 4, 'teal')!;
    expect(result.classes.map((c) => c.count)).toEqual([25, 25, 25, 25]);
    expect(result.classes[0].min).toBe(1);
    expect(result.classes.at(-1)!.max).toBe(100);
  });

  it('equal classes cover the same span of values', () => {
    const result = classify([0, 1, 2, 98, 100], 'equal', 4, 'teal')!;
    expect(result.classes.map((c) => [c.min, c.max])).toEqual([
      [0, 25],
      [25, 50],
      [50, 75],
      [75, 100],
    ]);
    expect(result.classes.map((c) => c.count)).toEqual([3, 0, 0, 2]);
  });

  it('classOf puts boundary values in the upper class', () => {
    const result = classify([0, 100], 'equal', 4, 'teal')!;
    expect(result.classOf(0)).toBe(0);
    expect(result.classOf(24.9)).toBe(0);
    expect(result.classOf(25)).toBe(1);
    expect(result.classOf(100)).toBe(3);
  });

  it('uses the palette colors for the class count', () => {
    const result = classify(range(50), 'quantile', 5, 'blues')!;
    expect(result.classes.map((c) => c.color)).toEqual(PALETTES.blues.colors(5));
  });

  it('makes fewer classes when there are few distinct values', () => {
    const result = classify([5, 5, 5, 5], 'quantile', 5, 'teal')!;
    expect(result.classes).toHaveLength(1);
    expect(result.classes[0]).toMatchObject({ min: 5, max: 5, count: 4 });
  });

  it('clamps the class count to 3..9', () => {
    expect(classify(range(100), 'quantile', 1, 'teal')!.classes).toHaveLength(3);
    expect(classify(range(100), 'quantile', 20, 'teal')!.classes).toHaveLength(9);
  });

  it('ignores non-finite values and returns null when nothing is left', () => {
    expect(classify([NaN, Infinity], 'quantile', 5, 'teal')).toBeNull();
    expect(classify([], 'quantile', 5, 'teal')).toBeNull();
    expect(classify([1, NaN, 2, 3], 'quantile', 3, 'teal')!.classes.reduce((n, c) => n + c.count, 0)).toBe(3);
  });

  it('builds viridis colors for any class count', () => {
    expect(PALETTES.viridis.colors(7)).toHaveLength(7);
  });
});

describe('formatNumber', () => {
  it('shortens large numbers and keeps small ones precise', () => {
    expect(formatNumber(1_234_567)).toBe('1.2M');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(0.256)).toBe('0.26');
  });
});
