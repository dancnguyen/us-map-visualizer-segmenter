import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import type { Segment } from '../store/segments';
import { SEGMENT_COLORS } from '../store/segments';

interface Props {
  /** Segment to edit, or initial values for a new one */
  initial: Pick<Segment, 'name' | 'color'>;
  title: string;
  submitLabel: string;
  onSubmit: (fields: Pick<Segment, 'name' | 'color'>) => void;
  onClose: () => void;
}

/** Name and color for a segment. Mount it only while open, so it starts fresh. */
export default function SegmentDialog({ initial, title, submitLabel, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      // autoFocus loses to the dialog's focus trap, so focus once the dialog is shown.
      slotProps={{ transition: { onEntered: () => nameRef.current?.select() } }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={nameRef}
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="dense"
            error={!name.trim()}
            helperText={!name.trim() ? 'Give the segment a name' : ' '}
          />
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
            Color
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {SEGMENT_COLORS.map((c) => (
              <IconButton
                key={c}
                aria-label={`Color ${c}`}
                aria-pressed={c.toLowerCase() === color.toLowerCase()}
                onClick={() => setColor(c)}
                sx={{ bgcolor: c, width: 32, height: 32, '&:hover': { bgcolor: c, opacity: 0.85 } }}
              >
                {c.toLowerCase() === color.toLowerCase() && <CheckIcon fontSize="small" sx={{ color: '#fff' }} />}
              </IconButton>
            ))}
            <Tooltip title="Custom color">
              <Box
                component="input"
                type="color"
                aria-label="Custom color"
                value={color}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
                sx={{ width: 36, height: 36, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}
              />
            </Tooltip>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
