import { create } from 'zustand';
import { cityKey } from '../lib/matching';

/** Row in public/data/zips.json: [zip, lat, lon] */
export type ZipRow = [zip: string, lat: number, lon: number];
/** Row in public/data/cities.json: [censusGeoId, name, stateAbbr, lat, lon] */
export type CityRow = [id: string, name: string, state: string, lat: number, lon: number];

export interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

export interface GeoData {
  /** ZIP code -> center point */
  zips: Map<string, { lat: number; lon: number }>;
  /** Sorted ZIP codes, for search */
  zipList: string[];
  /** Census place GEOID -> city */
  cities: Map<string, City>;
  /** All cities, sorted by state then name */
  cityList: City[];
  /** "normalized name|ST" -> cities with that name in that state */
  citiesByKey: Map<string, City[]>;
  /** "ST" -> cities in that state */
  citiesByState: Map<string, City[]>;
}

export const cityLabel = (city: Pick<City, 'name' | 'state'>) => `${city.name}, ${city.state}`;

export function buildGeoData(zipRows: ZipRow[], cityRows: CityRow[]): GeoData {
  const zips = new Map(zipRows.map(([zip, lat, lon]) => [zip, { lat, lon }]));
  const cityList = cityRows.map(([id, name, state, lat, lon]) => ({ id, name, state, lat, lon }));
  const cities = new Map(cityList.map((c) => [c.id, c]));
  const citiesByKey = new Map<string, City[]>();
  const citiesByState = new Map<string, City[]>();
  for (const city of cityList) {
    const key = cityKey(city.name, city.state);
    citiesByKey.set(key, [...(citiesByKey.get(key) ?? []), city]);
    const inState = citiesByState.get(city.state);
    if (inState) inState.push(city);
    else citiesByState.set(city.state, [city]);
  }
  return { zips, zipList: zipRows.map((r) => r[0]), cities, cityList, citiesByKey, citiesByState };
}

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

interface GeoDataState {
  data: GeoData | null;
  error: string | null;
  load: () => Promise<void>;
}

/** ZIP and city reference data, loaded once at startup. */
export const useGeoData = create<GeoDataState>((set, get) => ({
  data: null,
  error: null,
  load: async () => {
    if (get().data) return;
    set({ error: null });
    try {
      const [zipRows, cityRows] = await Promise.all([
        fetchJson<ZipRow[]>('zips.json'),
        fetchJson<CityRow[]>('cities.json'),
      ]);
      set({ data: buildGeoData(zipRows, cityRows) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
