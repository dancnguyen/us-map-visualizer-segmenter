import { describe, expect, it } from 'vitest';
import { layoutLegend } from './mapImage';

const items = ['a', 'bb', 'ccc', 'dddd'].map((label) => ({ label, color: '#000' }));
const measure = (item: { label: string }) => item.label.length * 10;

describe('layoutLegend', () => {
  it('puts items on one row when they fit', () => {
    const { placed, rows } = layoutLegend(items, measure, 1000, 5);
    expect(rows).toBe(1);
    expect(placed.map((p) => p.x)).toEqual([0, 15, 40, 75]);
  });

  it('wraps to a new row when the next item would overflow', () => {
    const { placed, rows } = layoutLegend(items, measure, 50, 5);
    expect(placed.map((p) => [p.label, p.row, p.x])).toEqual([
      ['a', 0, 0],
      ['bb', 0, 15],
      ['ccc', 1, 0],
      ['dddd', 2, 0],
    ]);
    expect(rows).toBe(3);
  });

  it('keeps an item that is wider than the row on its own row', () => {
    expect(layoutLegend([{ label: 'x'.repeat(20), color: '#000' }], measure, 50, 5)).toMatchObject({ rows: 1 });
  });

  it('has no rows when there is nothing to show', () => {
    expect(layoutLegend([], measure, 100, 5)).toEqual({ placed: [], rows: 0 });
  });
});
