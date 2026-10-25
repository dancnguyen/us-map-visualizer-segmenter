import { describe, expect, it } from 'vitest';
import { geo } from '../test/fixtures';
import type { Segment } from '../store/segments';
import type { DataConfig } from './csv';
import { classify } from './classify';
import {
  buildDataset,
  dataResultsToCsv,
  guessConfig,
  numericColumns,
  parseCsvText,
  parseNumber,
  segmentsFromCsv,
  segmentsToCsv,
} from './csv';

const config = (fields: Partial<DataConfig>): DataConfig => ({
  keyType: 'zip',
  zipColumn: 'zip',
  cityColumn: '',
  stateColumn: '',
  valueColumn: 'value',
  method: 'quantile',
  classes: 5,
  palette: 'teal',
  ...fields,
});

describe('parseCsvText', () => {
  it('trims headers and skips blank lines', () => {
    const table = parseCsvText(' Zip Code ,Sales\n02134,10\n\n02135,20\n');
    expect(table.fields).toEqual(['Zip Code', 'Sales']);
    expect(table.rows).toEqual([
      { 'Zip Code': '02134', Sales: '10' },
      { 'Zip Code': '02135', Sales: '20' },
    ]);
  });
});

describe('parseNumber', () => {
  it.each([
    ['1,234', 1234],
    ['$1,234.50', 1234.5],
    ['12%', 12],
    [' -7 ', -7],
  ])('%s -> %d', (raw, n) => expect(parseNumber(raw)).toBe(n));

  it.each(['', '  ', 'n/a', undefined])('%j -> null', (raw) => expect(parseNumber(raw)).toBeNull());
});

describe('numericColumns and guessConfig', () => {
  it('finds ZIP and value columns from common header names', () => {
    const table = parseCsvText('Region,ZIP_Code,Customers\nEast,02134,10\nEast,02135,20');
    expect(numericColumns(table)).toEqual(['ZIP_Code', 'Customers']);
    expect(guessConfig(table)).toMatchObject({ keyType: 'zip', zipColumn: 'ZIP_Code', valueColumn: 'Customers' });
  });

  it('uses city and state when there is no ZIP column', () => {
    const table = parseCsvText('City,ST,Revenue\nAustin,TX,$100');
    expect(guessConfig(table)).toMatchObject({ keyType: 'city', cityColumn: 'City', stateColumn: 'ST', valueColumn: 'Revenue' });
  });
});

describe('buildDataset', () => {
  it('matches ZIPs, adds up duplicates and reports problems', () => {
    const table = parseCsvText('zip,value\n02134,10\n2134,5\n10001,7\n99999,1\n60601,');
    const ds = buildDataset(table, config({}), geo);
    expect([...ds.zipValues]).toEqual([
      ['02134', 15],
      ['10001', 7],
    ]);
    expect(ds).toMatchObject({ totalRows: 5, matchedRows: 3, noValueRows: 1, unmatched: ['99999'] });
  });

  it('matches cities by name and state', () => {
    const table = parseCsvText('city,state,value\nAustin,TX,3\nSaint Louis,Missouri,4\nNowhere,ZZ,1');
    const ds = buildDataset(table, config({ keyType: 'city', cityColumn: 'city', stateColumn: 'state' }), geo);
    expect([...ds.cityValues]).toEqual([
      ['4805000', 3],
      ['2965000', 4],
    ]);
    expect(ds.unmatched).toEqual(['Nowhere, ZZ']);
  });
});

describe('segment CSV round trip', () => {
  const segments: Segment[] = [
    { id: 'a', name: 'East', color: '#4e79a7', visible: true },
    { id: 'b', name: 'Texas, "the big one"', color: '#f28e2b', visible: false },
    { id: 'c', name: 'Empty', color: '#e15759', visible: true },
  ];
  const zipSegment = { '02134': 'a', '10001': 'a', '78701': 'b' };
  const citySegment = { '2507000': 'a', '4805000': 'b' };

  it('writes one row per area, keeping empty segments', () => {
    const csv = segmentsToCsv(segments, zipSegment, citySegment, geo);
    const rows = parseCsvText(csv).rows;
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({
      segment: 'East', color: '#4e79a7', type: 'ZIP', zip: '02134', city: '', state: '', city_id: '', lat: '42.3539', lon: '-71.1337',
    });
    expect(rows).toContainEqual({
      segment: 'East', color: '#4e79a7', type: 'City', zip: '', city: 'Boston', state: 'MA', city_id: '2507000', lat: '42.3383', lon: '-71.0814',
    });
    expect(rows).toContainEqual({ segment: 'Empty', color: '#e15759', type: '', zip: '', city: '', state: '', city_id: '', lat: '', lon: '' });
  });

  it('reads back what it wrote', () => {
    const imported = segmentsFromCsv(parseCsvText(segmentsToCsv(segments, zipSegment, citySegment, geo)), geo);
    expect(imported.segments.map(({ name, color }) => ({ name, color }))).toEqual(segments.map(({ name, color }) => ({ name, color })));
    const idByName = Object.fromEntries(imported.segments.map((s) => [s.name, s.id]));
    expect(imported.zipSegment).toEqual({ '02134': idByName.East, '10001': idByName.East, '78701': idByName['Texas, "the big one"'] });
    expect(imported.citySegment).toEqual({ '2507000': idByName.East, '4805000': idByName['Texas, "the big one"'] });
    expect(imported.unmatched).toEqual([]);
  });

  it('accepts a hand-made file without type or id columns', () => {
    const table = parseCsvText('Territory,ZIP,City,State\nNorth,02134,,\nNorth,,Austin,TX\nSouth,99999,,');
    const imported = segmentsFromCsv(table, geo);
    expect(imported.segments.map((s) => s.name)).toEqual(['North', 'South']);
    expect(Object.keys(imported.zipSegment)).toEqual(['02134']);
    expect(Object.keys(imported.citySegment)).toEqual(['4805000']);
    expect(imported.unmatched).toEqual(['99999']);
  });

  it('needs a segment column', () => {
    expect(() => segmentsFromCsv(parseCsvText('zip\n02134'), geo)).toThrow(/segment/);
  });
});

describe('dataResultsToCsv', () => {
  it('lists matched ZIPs with value, class and center, then entries not found', () => {
    const cfg = config({ classes: 3 });
    const ds = buildDataset(parseCsvText('zip,value\n10001,30\n02134,10\n02135,20\n99999,5'), cfg, geo);
    const classification = classify([...ds.zipValues.values()], 'quantile', 3, 'teal');
    const table = parseCsvText(dataResultsToCsv(ds, classification, cfg, geo));
    expect(table.fields).toEqual(['zip', 'lat', 'lon', 'value', 'class', 'range', 'color', 'status']);
    expect(table.rows.map((r) => [r.zip, r.value, r.class, r.status])).toEqual([
      ['02134', '10', '1', 'matched'],
      ['02135', '20', '2', 'matched'],
      ['10001', '30', '3', 'matched'],
      ['99999', '', '', 'not found'],
    ]);
    expect(table.rows[0]).toMatchObject({ lat: '42.3539', lon: '-71.1337', color: classification!.classes[0].color });
  });

  it('uses city columns and the uploaded value column name', () => {
    const cfg = config({ keyType: 'city', cityColumn: 'city', stateColumn: 'state', valueColumn: 'Revenue' });
    const ds = buildDataset(parseCsvText('city,state,Revenue\nAustin,TX,5\nBoston,MA,7\nNowhere,ZZ,1'), cfg, geo);
    const table = parseCsvText(dataResultsToCsv(ds, null, cfg, geo));
    expect(table.fields).toEqual(['city', 'state', 'city_id', 'lat', 'lon', 'Revenue', 'class', 'range', 'color', 'status']);
    expect(table.rows.map((r) => [r.city, r.state, r.Revenue, r.status])).toEqual([
      ['Boston', 'MA', '7', 'matched'],
      ['Austin', 'TX', '5', 'matched'],
      ['Nowhere, ZZ', '', '', 'not found'],
    ]);
  });
});
