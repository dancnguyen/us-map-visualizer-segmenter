import { useMap } from 'react-map-gl/maplibre';
import AreaSearchField from '../components/AreaSearchField';
import { useUi } from '../store/ui';

/** Find a ZIP code or city and fly the map to it. */
export default function MapSearch() {
  const setFocus = useUi((s) => s.setFocus);
  const { main: map } = useMap();

  return (
    <AreaSearchField
      onChange={(result) => {
        setFocus(result ? { kind: result.kind, key: result.key } : null);
        if (result) map?.flyTo({ center: [result.lon, result.lat], zoom: result.kind === 'zip' ? 11 : 10 });
      }}
      sx={{ width: { xs: 'calc(100vw - 96px)', sm: 320 } }}
    />
  );
}
