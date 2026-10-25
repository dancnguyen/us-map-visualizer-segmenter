import { buildGeoData } from '../data/geoData';
import type { CityRow, ZipRow } from '../data/geoData';

/** A tiny stand-in for public/data/*.json. */
export const ZIP_ROWS: ZipRow[] = [
  ['02134', 42.3539, -71.1337],
  ['02135', 42.3496, -71.1565],
  ['10001', 40.7506, -73.9972],
  ['60601', 41.8858, -87.6181],
  ['78701', 30.2711, -97.7437],
];

export const CITY_ROWS: CityRow[] = [
  ['4805000', 'Austin', 'TX', 30.3005, -97.7522],
  ['2507000', 'Boston', 'MA', 42.3383, -71.0814],
  ['1706613', 'Bolingbrook', 'IL', 41.6987, -88.0828],
  ['1772000', 'Springfield', 'IL', 39.7911, -89.6446],
  ['2967000', 'Springfield', 'MO', 37.1943, -93.2915],
  ['2965000', 'St. Louis', 'MO', 38.6359, -90.2451],
  ['2758000', 'St. Paul', 'MN', 44.9488, -93.1038],
  ['0665042', 'San Buenaventura (Ventura)', 'CA', 34.2678, -119.2542],
  ['3651000', 'New York', 'NY', 40.6627, -73.9387],
  ['3601000', 'Albany', 'NY', 42.6664, -73.7987],
  ['4805032', 'Austin Lake', 'TX', 30.1, -97.1],
];

export const geo = buildGeoData(ZIP_ROWS, CITY_ROWS);
