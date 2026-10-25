import { useCallback, useMemo, useState } from 'react';
import Map, { Layer, NavigationControl, ScaleControl, Source } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { ExpressionSpecification } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import { useColorScheme, useTheme } from '@mui/material/styles';
import { useGeoData } from '../data/geoData';
import { colorMatch } from '../lib/mapColors';
import { radiusCircle } from '../lib/radius';
import { areaResult } from '../lib/search';
import type { AreaKind } from '../store/segments';
import { useSegments } from '../store/segments';
import { useUi } from '../store/ui';
import AreaTooltip from './AreaTooltip';
import MapOverlay from './MapOverlay';
import { useAreaColors } from './useAreaColors';

// MapLibre computes its worker's path at runtime, which bundlers can't see.
// Importing it with ?url makes Vite ship the file and tells MapLibre where it is.
maplibregl.setWorkerUrl(maplibreWorkerUrl);
// Lets MapLibre read the ZIP outlines straight from one static .pmtiles file.
maplibregl.addProtocol('pmtiles', new Protocol().tile);

const ZIP_TILES = `pmtiles://${new URL(`${import.meta.env.BASE_URL}data/zcta.pmtiles`, window.location.href).href}`;

// Free basemaps from OpenFreeMap (OpenStreetMap data); no API key needed.
const BASEMAPS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const CONTINENTAL_US: [number, number, number, number] = [-125, 24, -66.5, 49.5];
const NONE = 'rgba(0,0,0,0)';
/** Below this zoom, cities without a color are hidden (and not clickable). */
const CITY_DETAIL_ZOOM = 5;
/** ZIP outlines are easy to see from this zoom on, so segment ZIP dots fade out. */
const ZIP_DOTS_MAX_ZOOM = 8;

export interface HoverInfo {
  kind: AreaKind;
  key: string;
  /** Mouse position in the map */
  x: number;
  y: number;
  /** Map size, so the tooltip can stay inside it */
  width: number;
  height: number;
}

/** ['match', ['get', prop], [keys], true, false]: is this feature colored? */
function hasKey(prop: string, keys: string[]): ExpressionSpecification | boolean {
  return keys.length ? ['match', ['get', prop], keys, true, false] : false;
}

export default function MapView() {
  const theme = useTheme();
  const { mode: colorMode, systemMode } = useColorScheme();
  const isDark = (colorMode === 'system' ? systemMode : colorMode) !== 'light';

  const geo = useGeoData((s) => s.data);
  const geoError = useGeoData((s) => s.error);
  const mode = useUi((s) => s.mode);
  const showZips = useUi((s) => s.showZips);
  const showCities = useUi((s) => s.showCities);
  const focus = useUi((s) => s.focus);
  const radiusCenter = useUi((s) => s.radius?.center ?? null);
  const radiusMiles = useUi((s) => s.radius?.miles ?? 0);
  const toggle = useSegments((s) => s.toggle);
  const { zipGroups, cityGroups } = useAreaColors();

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [labelLayerId, setLabelLayerId] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const cityFeatures = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: (geo?.cityList ?? []).map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: { id: c.id, name: c.name, state: c.state },
      })),
    }),
    [geo],
  );

  // City ZIPs are smaller than a pixel when zoomed out. In segments mode, mark
  // segment ZIPs with a dot at their center until the outlines are big enough.
  const zipDots = useMemo<FeatureCollection<Point>>(() => {
    const features: FeatureCollection<Point>['features'] = [];
    if (mode === 'segments' && geo) {
      for (const { keys, color } of zipGroups) {
        for (const zip of keys) {
          const p = geo.zips.get(zip);
          if (p) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { zip, color } });
        }
      }
    }
    return { type: 'FeatureCollection', features };
  }, [mode, geo, zipGroups]);

  const radiusShape = useMemo(
    () => (radiusCenter && radiusMiles > 0 ? radiusCircle(radiusCenter, radiusMiles) : null),
    [radiusCenter, radiusMiles],
  );
  const radiusColor = theme.palette.primary.main;

  const colorText = isDark ? '#ffffff' : '#111827';
  const outline = isDark ? '#94a3b8' : '#64748b';
  const cityBase = isDark ? '#cbd5e1' : '#475569';

  const zipFill = useMemo(() => colorMatch('zip', zipGroups, NONE), [zipGroups]);
  const cityFill = useMemo(() => colorMatch('id', cityGroups, cityBase), [cityGroups, cityBase]);
  const coloredCityIds = useMemo(() => cityGroups.flatMap((g) => g.keys), [cityGroups]);
  const cityColored = useMemo(() => hasKey('id', coloredCityIds), [coloredCityIds]);
  const coloredCitySet = useMemo(() => new Set(coloredCityIds), [coloredCityIds]);

  const highlightZip = (hover?.kind === 'zip' && hover.key) || (focus?.kind === 'zip' && focus.key) || '';
  const highlightCity = (hover?.kind === 'city' && hover.key) || (focus?.kind === 'city' && focus.key) || '';

  const interactiveLayerIds = [...(showCities ? ['cities-circle'] : []), ...(showZips ? ['zips-fill'] : [])];

  /** Topmost area under the mouse, skipping cities that are hidden at this zoom. */
  const pickArea = useCallback(
    (e: MapLayerMouseEvent): Pick<HoverInfo, 'kind' | 'key'> | null => {
      const zoom = e.target.getZoom();
      for (const f of e.features ?? []) {
        const props = f.properties ?? {};
        if (f.layer.id === 'cities-circle') {
          if (zoom >= CITY_DETAIL_ZOOM || coloredCitySet.has(props.id)) return { kind: 'city', key: String(props.id) };
        } else if (f.layer.id === 'zips-fill' && props.zip) {
          return { kind: 'zip', key: String(props.zip) };
        }
      }
      return null;
    },
    [coloredCitySet],
  );

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const area = pickArea(e);
      const { clientWidth: width, clientHeight: height } = e.target.getContainer();
      setHover(area ? { ...area, x: e.point.x, y: e.point.y, width, height } : null);
    },
    [pickArea],
  );

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (mode !== 'segments') return;
      const area = pickArea(e);
      if (!area) return;
      // While the radius tool is open, a click picks its center.
      const ui = useUi.getState();
      if (ui.radius) {
        const geoData = useGeoData.getState().data;
        const center = geoData && areaResult(geoData, area.kind, area.key);
        if (center) ui.updateRadius({ center });
        return;
      }
      const { activeId, segments, updateSegment } = useSegments.getState();
      if (!activeId) {
        setMessage('Create or select a segment first, then click the map to add areas to it.');
        return;
      }
      // Show the segment if it was hidden, so the click has a visible effect.
      if (segments.find((s) => s.id === activeId)?.visible === false) updateSegment(activeId, { visible: true });
      toggle(area.kind, area.key);
    },
    [mode, pickArea, toggle],
  );

  /** Our fills go under the basemap's labels so place names stay readable. */
  const findLabelLayer = useCallback((map: maplibregl.Map) => {
    setLabelLayerId(map.getStyle()?.layers.find((l) => l.type === 'symbol')?.id);
  }, []);

  return (
    <Box sx={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0 }}>
      {!geo && !geoError && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }} />}
      {(geoError || mapError) && (
        <Alert severity="error" sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
          {geoError ? `Couldn't load ZIP and city data: ${geoError}` : mapError}
        </Alert>
      )}

      <Map
        id="main"
        mapLib={maplibregl}
        mapStyle={isDark ? BASEMAPS.dark : BASEMAPS.light}
        initialViewState={{ bounds: CONTINENTAL_US, fitBoundsOptions: { padding: 24 } }}
        minZoom={2}
        interactiveLayerIds={interactiveLayerIds}
        cursor={hover && mode === 'segments' ? 'pointer' : 'grab'}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        onLoad={(e) => findLabelLayer(e.target)}
        onStyleData={(e) => findLabelLayer(e.target)}
        onError={(e) => {
          console.error(e.error);
          if (/webgl/i.test(e.error?.message ?? '')) setMapError('Your browser could not start the map (WebGL 2 is required).');
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-right" unit="imperial" />

        <Source id="zips" type="vector" url={ZIP_TILES} attribution="U.S. Census Bureau">
          <Layer
            id="zips-fill"
            type="fill"
            source-layer="zips"
            beforeId={labelLayerId}
            layout={{ visibility: showZips ? 'visible' : 'none' }}
            paint={{ 'fill-color': zipFill, 'fill-opacity': mode === 'data' ? 0.8 : 0.6 }}
          />
          <Layer
            id="zips-outline"
            type="line"
            source-layer="zips"
            beforeId={labelLayerId}
            layout={{ visibility: showZips ? 'visible' : 'none' }}
            paint={{
              'line-color': outline,
              'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 10, 1],
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 7, 0.35, 10, 0.6],
            }}
          />
          <Layer
            id="zips-highlight"
            type="line"
            source-layer="zips"
            filter={['==', ['get', 'zip'], highlightZip]}
            layout={{ visibility: showZips ? 'visible' : 'none' }}
            paint={{ 'line-color': colorText, 'line-width': 2.5 }}
          />
          <Layer
            id="zips-label"
            type="symbol"
            source-layer="zips"
            minzoom={11}
            layout={{
              visibility: showZips ? 'visible' : 'none',
              'text-field': ['get', 'zip'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
            }}
            paint={{ 'text-color': colorText, 'text-halo-color': isDark ? '#000000' : '#ffffff', 'text-halo-width': 1.2 }}
          />
        </Source>

        {radiusShape && (
          <Source id="radius" type="geojson" data={radiusShape}>
            <Layer id="radius-fill" type="fill" paint={{ 'fill-color': radiusColor, 'fill-opacity': 0.1 }} />
            <Layer
              id="radius-outline"
              type="line"
              paint={{ 'line-color': radiusColor, 'line-width': 2, 'line-dasharray': [3, 2] }}
            />
          </Source>
        )}

        <Source id="zip-dots" type="geojson" data={zipDots}>
          <Layer
            id="zip-dots"
            type="circle"
            maxzoom={ZIP_DOTS_MAX_ZOOM}
            layout={{ visibility: showZips ? 'visible' : 'none' }}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, ZIP_DOTS_MAX_ZOOM, 5],
              'circle-opacity': ['interpolate', ['linear'], ['zoom'], ZIP_DOTS_MAX_ZOOM - 1.5, 0.9, ZIP_DOTS_MAX_ZOOM, 0],
              'circle-stroke-color': isDark ? '#0f172a' : '#ffffff',
              'circle-stroke-width': 0.5,
              'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], ZIP_DOTS_MAX_ZOOM - 1.5, 1, ZIP_DOTS_MAX_ZOOM, 0],
            }}
          />
        </Source>

        <Source id="cities" type="geojson" data={cityFeatures} attribution="U.S. Census Bureau">
          <Layer
            id="cities-circle"
            type="circle"
            layout={{ visibility: showCities ? 'visible' : 'none' }}
            paint={{
              'circle-color': cityFill,
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                3, ['case', cityColored, 3.5, 1.5],
                8, ['case', cityColored, 6, 3],
                12, ['case', cityColored, 9, 5],
              ],
              'circle-opacity': [
                'interpolate', ['linear'], ['zoom'],
                CITY_DETAIL_ZOOM - 0.01, ['case', cityColored, 0.95, 0],
                CITY_DETAIL_ZOOM + 2, ['case', cityColored, 0.95, 0.7],
              ],
              'circle-stroke-color': isDark ? '#0f172a' : '#ffffff',
              'circle-stroke-width': ['case', cityColored, 1, 0.5],
              'circle-stroke-opacity': [
                'interpolate', ['linear'], ['zoom'],
                CITY_DETAIL_ZOOM - 0.01, ['case', cityColored, 1, 0],
                CITY_DETAIL_ZOOM + 2, 1,
              ],
            }}
          />
          <Layer
            id="cities-highlight"
            type="circle"
            filter={['==', ['get', 'id'], highlightCity]}
            layout={{ visibility: showCities ? 'visible' : 'none' }}
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 12, 12],
              'circle-color': NONE,
              'circle-stroke-color': colorText,
              'circle-stroke-width': 2.5,
            }}
          />
        </Source>
      </Map>

      <MapOverlay />
      {hover && <AreaTooltip area={hover} />}

      <Snackbar
        open={message !== null}
        autoHideDuration={5000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setMessage(null)} variant="filled">
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
