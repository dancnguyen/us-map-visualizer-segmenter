import { describe, expect, it } from 'vitest';
import { fileStem } from './download';

describe('fileStem', () => {
  const day = new Date(2026, 9, 5);

  it('makes a lowercase, dash-separated name with the date', () => {
    expect(fileStem('East Sales: Q3!', day)).toBe('east-sales-q3-2026-10-05');
    expect(fileStem('Within 100 mi of Austin, TX', day)).toBe('within-100-mi-of-austin-tx-2026-10-05');
  });

  it('falls back to a default name', () => {
    expect(fileStem('  !!  ', day)).toBe('us-map-2026-10-05');
  });
});
