import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatNumber } from '../lib/classify';
import type { ValueClass } from '../lib/classify';
import ColorSwatch from './ColorSwatch';

interface Props {
  title?: string;
  classes: ValueClass[];
  /** Show how many areas fall in each class */
  showCounts?: boolean;
}

export default function DataLegend({ title, classes, showCounts = false }: Props) {
  return (
    <Stack spacing={0.5}>
      {title && (
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
      )}
      {classes.map((c) => (
        <Stack key={c.color} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ColorSwatch color={c.color} size={12} />
          <Typography variant="caption" sx={{ flex: 1 }}>
            {formatNumber(c.min)} – {formatNumber(c.max)}
          </Typography>
          {showCounts && (
            <Typography variant="caption" color="text.secondary">
              {c.count.toLocaleString()}
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
