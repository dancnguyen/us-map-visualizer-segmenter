import type { City, GeoData } from '../data/geoData';
import { toStateAbbr } from './states';

/**
 * Lowercase, "Saint" -> "st", no periods, single spaces. Parentheses and
 * slashes become spaces, so "San Buenaventura (Ventura)" contains "ventura".
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[()/]/g, ' ')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lookup key for a city: "normalized name|ST". */
export const cityKey = (name: string, state: string) => `${normalizeName(name)}|${state.toUpperCase()}`;

/**
 * Turns "02134", "02134-1234", or "2134" (leading zero lost in Excel) into a
 * 5-digit ZIP. Returns null for anything that isn't ZIP-shaped.
 */
export function normalizeZip(raw: string): string | null {
  const s = raw.trim();
  const m = /^(\d{3,5})(?:-\d{4})?$/.exec(s);
  return m ? m[1].padStart(5, '0') : null;
}

/** Finds a city by name and state ("Austin", "TX" or "Texas"). */
export function findCity(name: string, state: string, geo: GeoData): City | null {
  const abbr = toStateAbbr(state);
  if (!abbr || !name.trim()) return null;
  const exact = geo.citiesByKey.get(cityKey(name, abbr));
  if (exact?.length) return exact[0];

  // Census names some places differently ("Urban Honolulu"). Accept a unique
  // place in the state whose name contains the input as whole words.
  const target = normalizeName(name);
  const pattern = new RegExp(`(^|[\\s-])${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s-])`);
  const candidates = (geo.citiesByState.get(abbr) ?? []).filter((c) => pattern.test(normalizeName(c.name)));
  return candidates.length === 1 ? candidates[0] : null;
}

/** Splits "Austin, TX", "Austin TX" or "Austin, Texas" into name and state. */
export function splitCityState(text: string): { name: string; state: string } | null {
  const t = text.trim();
  const comma = /^(.+?),\s*([^,]+)$/.exec(t);
  if (comma) return { name: comma[1].trim(), state: comma[2].trim() };
  // No comma: the state is the last word, or the last two words ("New York").
  const words = t.split(/\s+/);
  for (const n of [2, 1]) {
    if (words.length <= n) continue;
    const state = words.slice(-n).join(' ');
    if (toStateAbbr(state)) {
      return { name: words.slice(0, -n).join(' '), state };
    }
  }
  return null;
}

export interface AreaListResult {
  zips: string[];
  cityIds: string[];
  /** Entries that couldn't be matched, as typed */
  unmatched: string[];
}

/**
 * Parses pasted text into known ZIP codes and cities. Accepts one entry per
 * line ("Austin, TX"), or ZIPs separated by commas, spaces or semicolons.
 */
export function parseAreaList(text: string, geo: GeoData): AreaListResult {
  const zips = new Set<string>();
  const cityIds = new Set<string>();
  const unmatched: string[] = [];

  for (const line of text.split(/[\n;]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
    if (tokens.every((t) => /^\d[\d-]*$/.test(t))) {
      for (const token of tokens) {
        const zip = normalizeZip(token);
        if (zip && geo.zips.has(zip)) zips.add(zip);
        else unmatched.push(token);
      }
      continue;
    }

    const parts = splitCityState(trimmed);
    const city = parts && findCity(parts.name, parts.state, geo);
    if (city) cityIds.add(city.id);
    else unmatched.push(trimmed);
  }

  return { zips: [...zips], cityIds: [...cityIds], unmatched };
}
