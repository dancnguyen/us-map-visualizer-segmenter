import Papa from 'papaparse';
import type { GeoData } from '../data/geoData';
import type { Segment } from '../store/segments';
import { SEGMENT_COLORS } from '../store/segments';
import { newId } from '../store/storage';
import type { Classification, ClassMethod, PaletteId } from './classify';
import { formatNumber } from './classify';
import { findCity, normalizeZip } from './matching';

export type CsvRow = Record<string, string>;

export interface CsvTable {
  fields: string[];
  rows: CsvRow[];
}

export function parseCsvText(text: string): CsvTable {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const fields = (result.meta.fields ?? []).filter(Boolean);
  return { fields, rows: result.data };
}

export async function readCsvFile(file: Blob): Promise<CsvTable> {
  return parseCsvText(await file.text());
}

/** "$1,234.50", "12%", " 7 " -> number; blank or text -> null. */
export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim().replace(/[$,%\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type KeyType = 'zip' | 'city';

export interface DataConfig {
  keyType: KeyType;
  zipColumn: string;
  cityColumn: string;
  stateColumn: string;
  valueColumn: string;
  method: ClassMethod;
  classes: number;
  palette: PaletteId;
}

const simplify = (h: string) => h.toLowerCase().replace(/[\s_.-]+/g, '');
const ZIP_HEADERS = ['zip', 'zips', 'zipcode', 'zip5', 'postal', 'postalcode', 'postcode', 'zcta', 'zcta5'];
const CITY_HEADERS = ['city', 'cityname', 'place', 'placename', 'town', 'municipality'];
const STATE_HEADERS = ['state', 'st', 'statecode', 'stateabbr', 'stateabbreviation', 'usps'];

const findHeader = (fields: string[], names: string[]) => fields.find((f) => names.includes(simplify(f))) ?? '';

/** Columns where at least 80% of non-blank values are numbers. */
export function numericColumns(table: CsvTable): string[] {
  const sample = table.rows.slice(0, 500);
  return table.fields.filter((field) => {
    const filled = sample.map((r) => r[field]).filter((v) => v != null && v.trim() !== '');
    if (filled.length === 0) return false;
    return filled.filter((v) => parseNumber(v) !== null).length / filled.length >= 0.8;
  });
}

/** Best guess at which columns hold the area and the value. */
export function guessConfig(table: CsvTable): Pick<DataConfig, 'keyType' | 'zipColumn' | 'cityColumn' | 'stateColumn' | 'valueColumn'> {
  const zipColumn = findHeader(table.fields, ZIP_HEADERS);
  const cityColumn = findHeader(table.fields, CITY_HEADERS);
  const stateColumn = findHeader(table.fields, STATE_HEADERS);
  const keyType: KeyType = !zipColumn && cityColumn && stateColumn ? 'city' : 'zip';
  const keyColumns = new Set([zipColumn, cityColumn, stateColumn]);
  const valueColumn = numericColumns(table).find((f) => !keyColumns.has(f)) ?? '';
  return { keyType, zipColumn: zipColumn || (keyType === 'zip' ? table.fields[0] ?? '' : ''), cityColumn, stateColumn, valueColumn };
}

export interface Dataset {
  /** ZIP -> value (rows for the same ZIP are added together) */
  zipValues: Map<string, number>;
  /** City GEOID -> value */
  cityValues: Map<string, number>;
  totalRows: number;
  matchedRows: number;
  /** Rows whose value column is blank or not a number */
  noValueRows: number;
  /** Area names that matched nothing, as written in the file */
  unmatched: string[];
}

export function buildDataset(table: CsvTable, config: DataConfig, geo: GeoData): Dataset {
  const zipValues = new Map<string, number>();
  const cityValues = new Map<string, number>();
  const unmatched: string[] = [];
  let matchedRows = 0;
  let noValueRows = 0;
  const add = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);

  for (const row of table.rows) {
    const value = parseNumber(row[config.valueColumn]);
    if (value === null) {
      noValueRows++;
      continue;
    }
    if (config.keyType === 'zip') {
      const raw = row[config.zipColumn] ?? '';
      const zip = normalizeZip(raw);
      if (zip && geo.zips.has(zip)) {
        add(zipValues, zip, value);
        matchedRows++;
      } else unmatched.push(raw);
    } else {
      const name = row[config.cityColumn] ?? '';
      const state = row[config.stateColumn] ?? '';
      const city = findCity(name, state, geo);
      if (city) {
        add(cityValues, city.id, value);
        matchedRows++;
      } else unmatched.push(`${name}, ${state}`);
    }
  }

  return { zipValues, cityValues, totalRows: table.rows.length, matchedRows, noValueRows, unmatched };
}

// ---- Segment import / export ----

const coord = (n: number | undefined) => (n === undefined ? '' : String(n));

/** lat/lon are each area's center point, for use in other tools; import ignores them. */
export const SEGMENT_CSV_FIELDS = ['segment', 'color', 'type', 'zip', 'city', 'state', 'city_id', 'lat', 'lon'] as const;

export function segmentsToCsv(
  segments: Segment[],
  zipSegment: Record<string, string>,
  citySegment: Record<string, string>,
  geo: GeoData | null,
): string {
  const data: string[][] = [];
  for (const { id, name, color } of segments) {
    const zips = Object.keys(zipSegment).filter((zip) => zipSegment[zip] === id).sort();
    const cityIds = Object.keys(citySegment).filter((cityId) => citySegment[cityId] === id);
    for (const zip of zips) {
      const p = geo?.zips.get(zip);
      data.push([name, color, 'ZIP', zip, '', '', '', coord(p?.lat), coord(p?.lon)]);
    }
    for (const cityId of cityIds) {
      const city = geo?.cities.get(cityId);
      data.push([name, color, 'City', '', city?.name ?? '', city?.state ?? '', cityId, coord(city?.lat), coord(city?.lon)]);
    }
    // Keep empty segments in the file so they survive a round trip.
    if (zips.length === 0 && cityIds.length === 0) data.push([name, color, '', '', '', '', '', '', '']);
  }
  return Papa.unparse({ fields: [...SEGMENT_CSV_FIELDS], data });
}

export interface ImportedSegments {
  segments: Segment[];
  zipSegment: Record<string, string>;
  citySegment: Record<string, string>;
  unmatched: string[];
}

/** Reads a file in the format written by segmentsToCsv. */
export function segmentsFromCsv(table: CsvTable, geo: GeoData): ImportedSegments {
  const col = (names: string[]) => findHeader(table.fields, names);
  const segmentCol = col(['segment', 'segmentname', 'name', 'group', 'territory']);
  if (!segmentCol) throw new Error('The file needs a "segment" column.');
  const colorCol = col(['color', 'colour']);
  const typeCol = col(['type', 'kind']);
  const zipCol = col(ZIP_HEADERS);
  const cityCol = col(CITY_HEADERS);
  const stateCol = col(STATE_HEADERS);
  const cityIdCol = col(['cityid', 'geoid', 'placegeoid']);

  const segments: Segment[] = [];
  const byName = new Map<string, Segment>();
  const zipSegment: Record<string, string> = {};
  const citySegment: Record<string, string> = {};
  const unmatched: string[] = [];

  for (const row of table.rows) {
    const name = row[segmentCol]?.trim();
    if (!name) continue;
    let segment = byName.get(name);
    if (!segment) {
      const color = row[colorCol]?.trim();
      segment = {
        id: newId(),
        name,
        color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : SEGMENT_COLORS[segments.length % SEGMENT_COLORS.length],
        visible: true,
      };
      segments.push(segment);
      byName.set(name, segment);
    }

    const type = row[typeCol]?.trim().toLowerCase();
    const zipRaw = row[zipCol]?.trim();
    const cityName = row[cityCol]?.trim();
    if (type === 'zip' || (!type && zipRaw)) {
      const zip = normalizeZip(zipRaw ?? '');
      if (zip && geo.zips.has(zip)) zipSegment[zip] = segment.id;
      else if (zipRaw) unmatched.push(zipRaw);
    } else if (type === 'city' || (!type && cityName)) {
      const byId = row[cityIdCol]?.trim();
      const city = (byId && geo.cities.get(byId)) || findCity(cityName ?? '', row[stateCol] ?? '', geo);
      if (city) citySegment[city.id] = segment.id;
      else unmatched.push(`${cityName}, ${row[stateCol] ?? ''}`);
    }
  }

  return { segments, zipSegment, citySegment, unmatched };
}

// ---- Data results export ----

/**
 * One row per matched area with its value and color class, then one row per
 * entry in the file that matched nothing (status "not found").
 */
export function dataResultsToCsv(dataset: Dataset, classification: Classification | null, config: DataConfig, geo: GeoData): string {
  const isZip = config.keyType === 'zip';
  const valueHeader = config.valueColumn || 'value';
  const fields = [
    ...(isZip ? ['zip'] : ['city', 'state', 'city_id']),
    'lat',
    'lon',
    valueHeader,
    'class',
    'range',
    'color',
    'status',
  ];
  const describe = (value: number) => {
    if (!classification) return ['', '', ''];
    const i = classification.classOf(value);
    const c = classification.classes[i];
    return [String(i + 1), `${formatNumber(c.min)} – ${formatNumber(c.max)}`, c.color];
  };

  const data: string[][] = [];
  if (isZip) {
    for (const [zip, value] of [...dataset.zipValues].sort(([a], [b]) => a.localeCompare(b))) {
      const p = geo.zips.get(zip);
      data.push([zip, coord(p?.lat), coord(p?.lon), String(value), ...describe(value), 'matched']);
    }
  } else {
    const rows = [...dataset.cityValues].map(([id, value]) => ({ city: geo.cities.get(id), id, value }));
    rows.sort((a, b) => `${a.city?.state}${a.city?.name}`.localeCompare(`${b.city?.state}${b.city?.name}`));
    for (const { city, id, value } of rows) {
      data.push([city?.name ?? '', city?.state ?? '', id, coord(city?.lat), coord(city?.lon), String(value), ...describe(value), 'matched']);
    }
  }
  for (const raw of dataset.unmatched) {
    const key = isZip ? [raw] : [raw, '', ''];
    data.push([...key, '', '', '', '', '', '', 'not found']);
  }
  return Papa.unparse({ fields, data });
}
