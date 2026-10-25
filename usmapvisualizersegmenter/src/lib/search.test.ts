import { describe, expect, it } from 'vitest';
import { geo } from '../test/fixtures';
import { areaResult, resultName, searchAreas } from './search';

const labels = (q: string) => searchAreas(geo, q).map((r) => r.label);

describe('searchAreas', () => {
  it('finds ZIPs by their first digits', () => {
    expect(labels('021')).toEqual(['02134', '02135']);
    expect(labels('99')).toEqual([]);
  });

  it('puts exact city names first', () => {
    expect(labels('austin')).toEqual(['Austin, TX', 'Austin Lake, TX']);
  });

  it('filters by state after a comma', () => {
    expect(labels('springfield, il')).toEqual(['Springfield, IL']);
    expect(labels('springfield, Missouri')).toEqual(['Springfield, MO']);
    expect(labels('springfield, m')).toEqual(['Springfield, MO']);
  });

  it('matches a later word in the name', () => {
    expect(labels('ventura')).toEqual(['San Buenaventura (Ventura), CA']);
  });

  it('returns coordinates for flying the map', () => {
    expect(searchAreas(geo, '02134')[0]).toMatchObject({ kind: 'zip', key: '02134', lat: 42.3539, lon: -71.1337 });
  });

  it('respects the limit', () => {
    expect(searchAreas(geo, '0', 2)).toHaveLength(2);
  });

  it('returns nothing for blank input', () => {
    expect(searchAreas(geo, '   ')).toEqual([]);
  });
});

describe('areaResult and resultName', () => {
  it('describes a ZIP or city with its coordinates', () => {
    const zip = areaResult(geo, 'zip', '02134')!;
    expect(zip).toEqual({ kind: 'zip', key: '02134', label: '02134', lat: 42.3539, lon: -71.1337 });
    expect(resultName(zip)).toBe('ZIP 02134');
    const city = areaResult(geo, 'city', '4805000')!;
    expect(resultName(city)).toBe('Austin, TX');
  });

  it('returns null for unknown areas', () => {
    expect(areaResult(geo, 'zip', '99999')).toBeNull();
    expect(areaResult(geo, 'city', 'nope')).toBeNull();
  });
});
