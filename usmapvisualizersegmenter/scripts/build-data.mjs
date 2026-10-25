// Builds the map data in public/data from U.S. Census Bureau sources.
//
//   npm run data:build
//
// Outputs:
//   public/data/zcta.pmtiles  ZIP code (ZCTA) outlines as vector tiles
//   public/data/zips.json     every ZIP with its center point
//   public/data/cities.json   every Census place (city/town/CDP) with its center point
//
// Requires `tippecanoe` (v2.17+) on the PATH, or its path in the TIPPECANOE env var.
//   Ubuntu/Debian: sudo apt install tippecanoe     macOS: brew install tippecanoe
// Downloads are cached in .data-cache/ so re-runs are fast.

import { mkdir, writeFile, readFile, access, stat, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import Papa from 'papaparse';
import mapshaper from 'mapshaper';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.data-cache');
const OUT = path.join(ROOT, 'public', 'data');

const SOURCES = {
  // 2020 cartographic boundary ZCTAs (the latest vintage the Census publishes for ZCTAs).
  zctaShapes: 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip',
  zctaGazetteer:
    'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip',
  placeGazetteer:
    'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip',
};

const TIPPECANOE = process.env.TIPPECANOE || 'tippecanoe';

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const file = path.join(CACHE, path.basename(url));
  if (await exists(file)) return file;
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** Reads the single tab-delimited .txt file inside a Census Gazetteer zip. */
async function readGazetteer(zipFile) {
  const entries = unzipSync(new Uint8Array(await readFile(zipFile)));
  const name = Object.keys(entries).find((n) => n.endsWith('.txt'));
  if (!name) throw new Error(`No .txt file in ${zipFile}`);
  const { data } = Papa.parse(strFromU8(entries[name]), {
    header: true,
    delimiter: '\t',
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(), // The last header has trailing spaces.
  });
  return data;
}

const round = (n) => Math.round(Number(n) * 1e4) / 1e4;

// Census names that differ from what people call the place.
// (There is also an "East Honolulu", so "Honolulu" alone would be ambiguous.)
const PLACE_RENAMES = { 'Urban Honolulu|HI': 'Honolulu' };

/**
 * Census place names end with their legal type, e.g. "Austin city",
 * "Boise City city", "Honolulu CDP". Drops those trailing words.
 */
export function cleanPlaceName(name) {
  const words = name.trim().split(/\s+/);
  while (words.length > 1) {
    const last = words[words.length - 1];
    if (last === 'CDP' || last === '(balance)' || /^[a-z]+$/.test(last)) words.pop();
    else break;
  }
  return words.join(' ');
}

async function buildZipPoints() {
  const rows = await readGazetteer(await download(SOURCES.zctaGazetteer));
  const zips = rows
    .map((r) => [r.GEOID, round(r.INTPTLAT), round(r.INTPTLONG)])
    .sort((a, b) => a[0].localeCompare(b[0]));
  await writeFile(path.join(OUT, 'zips.json'), JSON.stringify(zips));
  console.log(`zips.json: ${zips.length} ZIP codes`);
}

async function buildCityPoints() {
  const rows = await readGazetteer(await download(SOURCES.placeGazetteer));
  const cities = rows
    .map((r) => {
      const name = cleanPlaceName(r.NAME);
      return [r.GEOID, PLACE_RENAMES[`${name}|${r.USPS}`] ?? name, r.USPS, round(r.INTPTLAT), round(r.INTPTLONG)];
    })
    .sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));
  await writeFile(path.join(OUT, 'cities.json'), JSON.stringify(cities));
  console.log(`cities.json: ${cities.length} places`);
}

async function buildZipTiles() {
  const version = spawnSync(TIPPECANOE, ['--version'], { encoding: 'utf8' });
  if (version.error) {
    throw new Error(
      `tippecanoe not found (${version.error.message}). Install it ` +
        '(sudo apt install tippecanoe / brew install tippecanoe) or set TIPPECANOE=/path/to/tippecanoe.',
    );
  }

  const shapes = await download(SOURCES.zctaShapes);
  const geojson = path.join(CACHE, 'zcta.geojsonl');
  console.log('Converting ZIP shapes to GeoJSON (mapshaper)...');
  await mapshaper.runCommands(
    `-i "${shapes}" -rename-fields zip=ZCTA5CE20 -filter-fields zip ` +
      `-proj wgs84 -o "${geojson}" format=geojson ndjson precision=0.00001 force`,
  );

  console.log('Building vector tiles (tippecanoe)...');
  const out = path.join(OUT, 'zcta.pmtiles');
  const result = spawnSync(
    TIPPECANOE,
    [
      '--output', out,
      '--force',
      '--layer', 'zips',
      '--name', 'US ZIP Code Tabulation Areas (2020)',
      '--attribution', 'U.S. Census Bureau',
      // Zoom 3 shows the whole country; past zoom 10 the map just overzooms.
      '--minimum-zoom', '3',
      '--maximum-zoom', '10',
      // Keep every ZIP at every zoom, so the national view can color all of them.
      '--no-feature-limit',
      '--no-tile-size-limit',
      // Neighboring ZIPs simplify along the same line, so no gaps or slivers.
      '--detect-shared-borders',
      '--simplification', '4',
      '--quiet',
      geojson,
    ],
    { stdio: 'inherit' },
  );
  await rm(geojson, { force: true }); // 120+ MB and rebuilt every run
  if (result.status !== 0) throw new Error(`tippecanoe exited with ${result.status}`);
  const { size } = await stat(out);
  console.log(`zcta.pmtiles: ${(size / 1e6).toFixed(1)} MB`);
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(OUT, { recursive: true });
  const only = process.argv[2]; // optional: zips | cities | tiles
  if (!only || only === 'zips') await buildZipPoints();
  if (!only || only === 'cities') await buildCityPoints();
  if (!only || only === 'tiles') await buildZipTiles();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
