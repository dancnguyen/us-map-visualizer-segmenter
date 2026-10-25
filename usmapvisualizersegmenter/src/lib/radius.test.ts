import { describe, expect, it } from 'vitest';
import { geo } from '../test/fixtures';
import { areasWithinRadius, radiusBounds, radiusSegmentName } from './radius';

const allston = { lat: 42.3539, lon: -71.1337 }; // ZIP 02134
const both = { zips: true, cities: true };

describe('areasWithinRadius', () => {
  it('finds areas whose center is inside the radius', () => {
    expect(areasWithinRadius(geo, allston, 10, both)).toEqual({ zips: ['02134', '02135'], cityIds: ['2507000'] });
  });

  it('measures straight-line miles (Allston to Manhattan is about 190)', () => {
    expect(areasWithinRadius(geo, allston, 150, both).zips).not.toContain('10001');
    expect(areasWithinRadius(geo, allston, 250, both).zips).toContain('10001');
    expect(areasWithinRadius(geo, allston, 250, both).cityIds).toContain('3651000'); // New York
  });

  it('only includes the requested kinds', () => {
    expect(areasWithinRadius(geo, allston, 10, { zips: true, cities: false }).cityIds).toEqual([]);
    expect(areasWithinRadius(geo, allston, 10, { zips: false, cities: true }).zips).toEqual([]);
  });

  it('returns nothing for a zero, negative or missing radius', () => {
    for (const miles of [0, -5, NaN]) expect(areasWithinRadius(geo, allston, miles, both)).toEqual({ zips: [], cityIds: [] });
  });

  it('covers the whole country with a large radius', () => {
    const result = areasWithinRadius(geo, allston, 3000, both);
    expect(result.zips).toHaveLength(geo.zips.size);
    expect(result.cityIds).toHaveLength(geo.cityList.length);
  });
});

describe('radiusBounds', () => {
  it('is a box around the center about 2 x radius tall', () => {
    const [[west, south], [east, north]] = radiusBounds(allston, 69);
    expect(west).toBeLessThan(allston.lon);
    expect(east).toBeGreaterThan(allston.lon);
    expect(north - south).toBeCloseTo(2, 1); // 69 miles is about 1 degree of latitude
  });
});

describe('radiusSegmentName', () => {
  it('names the segment after the radius and place', () => {
    expect(radiusSegmentName(100, 'Austin, TX')).toBe('Within 100 mi of Austin, TX');
    expect(radiusSegmentName(1500, 'ZIP 02134')).toBe('Within 1,500 mi of ZIP 02134');
  });
});
