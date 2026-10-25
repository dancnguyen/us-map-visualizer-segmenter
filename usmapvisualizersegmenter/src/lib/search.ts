import type { GeoData } from '../data/geoData';
import { cityLabel } from '../data/geoData';
import type { AreaKind } from '../store/segments';
import { normalizeName } from './matching';
import { toStateAbbr } from './states';

export interface SearchResult {
  kind: AreaKind;
  key: string;
  label: string;
  lat: number;
  lon: number;
}

/** A clicked or listed area as a search result (label and coordinates). */
export function areaResult(geo: GeoData, kind: AreaKind, key: string): SearchResult | null {
  if (kind === 'zip') {
    const p = geo.zips.get(key);
    return p ? { kind, key, label: key, lat: p.lat, lon: p.lon } : null;
  }
  const c = geo.cities.get(key);
  return c ? { kind, key, label: cityLabel(c), lat: c.lat, lon: c.lon } : null;
}

/** How to name the area in text: "ZIP 02134" or "Austin, TX". */
export const resultName = (r: SearchResult) => (r.kind === 'zip' ? `ZIP ${r.label}` : r.label);

const normalizedNames = new WeakMap<GeoData, string[]>();

function cityNames(geo: GeoData): string[] {
  let names = normalizedNames.get(geo);
  if (!names) {
    names = geo.cityList.map((c) => normalizeName(c.name));
    normalizedNames.set(geo, names);
  }
  return names;
}

/**
 * ZIP codes starting with the typed digits, or cities whose name starts with
 * the typed text ("spring", "springfield, il"). Exact name matches come first.
 */
export function searchAreas(geo: GeoData, query: string, limit = 20): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  if (/^\d{1,5}$/.test(q)) {
    const results: SearchResult[] = [];
    for (const zip of geo.zipList) {
      if (!zip.startsWith(q)) continue;
      const p = geo.zips.get(zip)!;
      results.push({ kind: 'zip', key: zip, label: zip, lat: p.lat, lon: p.lon });
      if (results.length >= limit) break;
    }
    return results;
  }

  const names = cityNames(geo);

  // "springfield, il" -> name "springfield", state IL. A partial state ("i") matches IL, IN, IA, ID.
  const [namePart, statePart = ''] = q.split(',');
  const name = normalizeName(namePart);
  if (!name) return [];
  const statePrefix = statePart.trim().toUpperCase();
  const stateAbbr = statePrefix ? toStateAbbr(statePrefix) : null;
  const stateOk = (st: string) => (stateAbbr ? st === stateAbbr : st.startsWith(statePrefix));

  // Rank: exact name, then names starting with the text, then a later word
  // starting with it ("ventura" finds "San Buenaventura (Ventura)").
  const matches: { index: number; rank: number }[] = [];
  names.forEach((n, index) => {
    if (!stateOk(geo.cityList[index].state)) return;
    const rank = n === name ? 0 : n.startsWith(name) ? 1 : n.includes(` ${name}`) || n.includes(`-${name}`) ? 2 : -1;
    if (rank >= 0) matches.push({ index, rank });
  });
  matches.sort((a, b) => a.rank - b.rank || names[a.index].length - names[b.index].length);

  return matches.slice(0, limit).map(({ index }) => {
    const c = geo.cityList[index];
    return { kind: 'city', key: c.id, label: cityLabel(c), lat: c.lat, lon: c.lon };
  });
}
