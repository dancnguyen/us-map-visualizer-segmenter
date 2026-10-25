import { bbox } from '@turf/bbox';
import { circle } from '@turf/circle';
import { distance } from '@turf/distance';
import type { Feature, Polygon } from 'geojson';
import type { GeoData } from '../data/geoData';

export interface LatLon {
  lat: number;
  lon: number;
}

export const MAX_RADIUS_MILES = 3000;

/** About 69 miles per degree of latitude; used to skip far-away points quickly. */
const MILES_PER_DEGREE_LAT = 69;

export interface RadiusResult {
  zips: string[];
  cityIds: string[];
}

/**
 * ZIP codes and cities whose center point is within `miles` of `center`,
 * measured in a straight line over the earth's surface.
 */
export function areasWithinRadius(
  geo: GeoData,
  center: LatLon,
  miles: number,
  include: { zips: boolean; cities: boolean },
): RadiusResult {
  if (!(miles > 0)) return { zips: [], cityIds: [] };
  const from = [center.lon, center.lat];
  const latLimit = miles / MILES_PER_DEGREE_LAT + 0.01;
  const within = (p: LatLon) =>
    Math.abs(p.lat - center.lat) <= latLimit && distance(from, [p.lon, p.lat], { units: 'miles' }) <= miles;

  const zips: string[] = [];
  if (include.zips) {
    for (const [zip, p] of geo.zips) if (within(p)) zips.push(zip);
  }
  const cityIds: string[] = [];
  if (include.cities) {
    for (const city of geo.cityList) if (within(city)) cityIds.push(city.id);
  }
  return { zips, cityIds };
}

/** The radius as a polygon, for drawing on the map. */
export function radiusCircle(center: LatLon, miles: number): Feature<Polygon> {
  return circle([center.lon, center.lat], miles, { units: 'miles', steps: 128 });
}

/** [[west, south], [east, north]] around the radius, for fitting the map. */
export function radiusBounds(center: LatLon, miles: number): [[number, number], [number, number]] {
  const [west, south, east, north] = bbox(radiusCircle(center, miles));
  return [
    [west, south],
    [east, north],
  ];
}

/** "Within 100 mi of Austin, TX" */
export function radiusSegmentName(miles: number, placeLabel: string): string {
  return `Within ${miles.toLocaleString('en-US')} mi of ${placeLabel}`;
}
