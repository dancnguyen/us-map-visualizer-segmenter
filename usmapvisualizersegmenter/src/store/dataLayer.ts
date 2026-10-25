import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGeoData } from '../data/geoData';
import type { GeoData } from '../data/geoData';
import { classify } from '../lib/classify';
import type { Classification } from '../lib/classify';
import { buildDataset, guessConfig } from '../lib/csv';
import type { CsvTable, DataConfig, Dataset } from '../lib/csv';
import { safeStorage } from './storage';

const DEFAULT_CONFIG: DataConfig = {
  keyType: 'zip',
  zipColumn: '',
  cityColumn: '',
  stateColumn: '',
  valueColumn: '',
  method: 'quantile',
  classes: 5,
  palette: 'teal',
};

interface DataLayerState {
  fileName: string | null;
  table: CsvTable | null;
  config: DataConfig;
  setTable: (fileName: string, table: CsvTable) => void;
  setConfig: (fields: Partial<DataConfig>) => void;
  clear: () => void;
}

/** The uploaded CSV and how it's mapped to colors. */
export const useDataLayer = create<DataLayerState>()(
  persist(
    (set) => ({
      fileName: null,
      table: null,
      config: DEFAULT_CONFIG,
      setTable: (fileName, table) =>
        set((s) => ({ fileName, table, config: { ...s.config, ...guessConfig(table) } })),
      setConfig: (fields) => set((s) => ({ config: { ...s.config, ...fields } })),
      clear: () => set({ fileName: null, table: null, config: DEFAULT_CONFIG }),
    }),
    { name: 'usmap.data', version: 1, storage: safeStorage },
  ),
);

export interface ResolvedData {
  dataset: Dataset;
  classification: Classification | null;
}

// Several components read the resolved data; compute it once per input change.
let cache: { geo: GeoData; table: CsvTable; config: DataConfig; result: ResolvedData } | null = null;

function resolve(geo: GeoData, table: CsvTable, config: DataConfig): ResolvedData {
  if (cache && cache.geo === geo && cache.table === table && cache.config === config) return cache.result;
  const dataset = buildDataset(table, config, geo);
  const values = [...(config.keyType === 'zip' ? dataset.zipValues : dataset.cityValues).values()];
  const result = { dataset, classification: classify(values, config.method, config.classes, config.palette) };
  cache = { geo, table, config, result };
  return result;
}

/** Matches the uploaded rows to areas and splits the values into color classes. */
export function useResolvedData(): ResolvedData | null {
  const geo = useGeoData((s) => s.data);
  const table = useDataLayer((s) => s.table);
  const config = useDataLayer((s) => s.config);
  return useMemo(
    () => (geo && table && config.valueColumn ? resolve(geo, table, config) : null),
    [geo, table, config],
  );
}
