import { describe, expect, it } from 'vitest';
import { geo } from '../test/fixtures';
import { findCity, normalizeName, normalizeZip, parseAreaList, splitCityState } from './matching';
import { toStateAbbr } from './states';

describe('normalizeZip', () => {
  it.each([
    ['02134', '02134'],
    [' 02134 ', '02134'],
    ['02134-1234', '02134'],
    ['2134', '02134'], // leading zero dropped by Excel
    ['501', '00501'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeZip(input)).toBe(expected);
  });

  it.each(['', 'abcde', '12', '123456', '02134-12'])('rejects %j', (input) => {
    expect(normalizeZip(input)).toBeNull();
  });
});

describe('normalizeName', () => {
  it('lowercases, drops periods and treats Saint as St', () => {
    expect(normalizeName('Saint  Louis')).toBe('st louis');
    expect(normalizeName('St. Louis')).toBe('st louis');
  });

  it('turns parentheses and slashes into word breaks', () => {
    expect(normalizeName('San Buenaventura (Ventura)')).toBe('san buenaventura ventura');
    expect(normalizeName('Louisville/Jefferson County')).toBe('louisville jefferson county');
  });
});

describe('toStateAbbr', () => {
  it('accepts abbreviations and full names in any case', () => {
    expect(toStateAbbr('tx')).toBe('TX');
    expect(toStateAbbr('Texas')).toBe('TX');
    expect(toStateAbbr('new  york')).toBe('NY');
    expect(toStateAbbr('D.C.')).toBe('DC');
  });

  it('returns null for anything else', () => {
    expect(toStateAbbr('ZZ')).toBeNull();
    expect(toStateAbbr('Texass')).toBeNull();
  });
});

describe('splitCityState', () => {
  it.each([
    ['Austin, TX', 'Austin', 'TX'],
    ['Austin TX', 'Austin', 'TX'],
    ['Austin, Texas', 'Austin', 'Texas'],
    ['Albany New York', 'Albany', 'New York'],
    ['New York NY', 'New York', 'NY'],
  ])('%s', (text, name, state) => {
    expect(splitCityState(text)).toEqual({ name, state });
  });

  it('returns null without a state', () => {
    expect(splitCityState('Austin')).toBeNull();
  });
});

describe('findCity', () => {
  it('finds exact names within the given state', () => {
    expect(findCity('Springfield', 'IL', geo)?.id).toBe('1772000');
    expect(findCity('springfield', 'Missouri', geo)?.id).toBe('2967000');
  });

  it('matches Saint/St. spellings', () => {
    expect(findCity('Saint Louis', 'MO', geo)?.id).toBe('2965000');
    expect(findCity('Saint Paul', 'MN', geo)?.id).toBe('2758000');
  });

  it('falls back to a unique whole-word match', () => {
    expect(findCity('Ventura', 'CA', geo)?.id).toBe('0665042');
  });

  it('does not guess when the fallback is ambiguous or partial', () => {
    expect(findCity('Bolingbrook', 'TX', geo)).toBeNull(); // wrong state
    expect(findCity('Bol', 'IL', geo)).toBeNull(); // not a whole word
  });

  it('returns null for an unknown state', () => {
    expect(findCity('Austin', 'ZZ', geo)).toBeNull();
  });
});

describe('parseAreaList', () => {
  it('reads ZIPs separated by commas, spaces, semicolons and lines', () => {
    const result = parseAreaList('02134, 02135 10001;60601\n78701', geo);
    expect(result.zips).toEqual(['02134', '02135', '10001', '60601', '78701']);
    expect(result.unmatched).toEqual([]);
  });

  it('reads one city per line', () => {
    const result = parseAreaList('Austin, TX\nSpringfield, Illinois\nSt. Louis MO', geo);
    expect(result.cityIds).toEqual(['4805000', '1772000', '2965000']);
  });

  it('mixes ZIPs and cities and reports what it could not match', () => {
    const result = parseAreaList('02134\nAustin, TX\n99999\nNowhere, ZZ\n\n', geo);
    expect(result.zips).toEqual(['02134']);
    expect(result.cityIds).toEqual(['4805000']);
    expect(result.unmatched).toEqual(['99999', 'Nowhere, ZZ']);
  });

  it('drops duplicates', () => {
    const result = parseAreaList('02134, 02134\nAustin, TX\nAustin TX', geo);
    expect(result.zips).toEqual(['02134']);
    expect(result.cityIds).toEqual(['4805000']);
  });
});
