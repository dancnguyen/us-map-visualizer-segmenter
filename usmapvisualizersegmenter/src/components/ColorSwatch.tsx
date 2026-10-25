import Box from '@mui/material/Box';

/** A small filled circle showing a segment or class color. */
export default function ColorSwatch({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        border: 1,
        borderColor: 'divider',
      }}
    />
  );
}
