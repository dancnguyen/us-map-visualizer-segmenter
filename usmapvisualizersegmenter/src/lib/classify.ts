import { scaleQuantile, scaleQuantize } from 'd3-scale';
import {
  interpolateViridis,
  schemeBlues,
  schemeBuGn,
  schemeOranges,
  schemePurples,
  schemeYlOrRd,
} from 'd3-scale-chromatic';

export type ClassMethod = 'quantile' | 'equal';

export const PALETTES = {
  teal: { label: 'Teal', colors: (k: number) => [...schemeBuGn[k]] },
  blues: { label: 'Blues', colors: (k: number) => [...schemeBlues[k]] },
  purples: { label: 'Purples', colors: (k: number) => [...schemePurples[k]] },
  oranges: { label: 'Oranges', colors: (k: number) => [...schemeOranges[k]] },
  heat: { label: 'Heat', colors: (k: number) => [...schemeYlOrRd[k]] },
  viridis: {
    label: 'Viridis',
    colors: (k: number) => Array.from({ length: k }, (_, i) => interpolateViridis(i / (k - 1))),
  },
} as const;

export type PaletteId = keyof typeof PALETTES;

export const MIN_CLASSES = 3;
export const MAX_CLASSES = 9;

export interface ValueClass {
  /** Inclusive lower bound */
  min: number;
  /** Upper bound (exclusive, except for the last class) */
  max: number;
  color: string;
  count: number;
}

export interface Classification {
  classes: ValueClass[];
  /** Index into `classes` for a value */
  classOf: (value: number) => number;
}

/**
 * Splits values into color classes.
 * - quantile: each class holds about the same number of areas
 * - equal: each class covers the same value range
 * Returns fewer classes than asked for when there aren't enough distinct values.
 */
export function classify(
  values: number[],
  method: ClassMethod,
  classCount: number,
  palette: PaletteId,
): Classification | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  const k = Math.min(MAX_CLASSES, Math.max(MIN_CLASSES, Math.round(classCount)));

  let min = Infinity;
  let max = -Infinity;
  for (const v of finite) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const rawThresholds =
    method === 'quantile'
      ? scaleQuantile<number>().domain(finite).range(Array.from({ length: k }, (_, i) => i)).quantiles()
      : scaleQuantize<number>().domain([min, max]).range(Array.from({ length: k }, (_, i) => i)).thresholds();

  // Drop duplicate breaks and breaks at the very bottom, which would make empty classes.
  const thresholds = [...new Set(rawThresholds)].filter((t) => t > min && t <= max).sort((a, b) => a - b);

  const n = thresholds.length + 1;
  const colors = n >= MIN_CLASSES ? PALETTES[palette].colors(n) : PALETTES[palette].colors(MIN_CLASSES).slice(-n);
  const bounds = [min, ...thresholds, max];

  const classOf = (value: number) => {
    let lo = 0;
    let hi = thresholds.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (value >= thresholds[mid]) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const classes: ValueClass[] = colors.map((color, i) => ({ min: bounds[i], max: bounds[i + 1], color, count: 0 }));
  for (const v of finite) classes[classOf(v)].count++;
  return { classes, classOf };
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Short number for legends: 1234567 -> "1.2M", 0.25 -> "0.25". */
export function formatNumber(n: number): string {
  return Math.abs(n) >= 10_000 ? compact.format(n) : precise.format(n);
}
