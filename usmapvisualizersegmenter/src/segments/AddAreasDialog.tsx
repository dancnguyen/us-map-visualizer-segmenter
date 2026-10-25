import { useDeferredValue, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useGeoData } from '../data/geoData';
import { pluralize } from '../lib/format';
import { parseAreaList } from '../lib/matching';
import type { Segment } from '../store/segments';
import { useSegments } from '../store/segments';

/** Paste a list of ZIP codes and/or cities to add to a segment. */
export default function AddAreasDialog({ segment, onClose }: { segment: Segment; onClose: () => void }) {
  const geo = useGeoData((s) => s.data);
  const assign = useSegments((s) => s.assign);
  const zipSegment = useSegments((s) => s.zipSegment);
  const citySegment = useSegments((s) => s.citySegment);
  const [text, setText] = useState('');
  const deferredText = useDeferredValue(text);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const result = useMemo(() => (geo ? parseAreaList(deferredText, geo) : null), [geo, deferredText]);
  const moving = result
    ? result.zips.filter((z) => zipSegment[z] && zipSegment[z] !== segment.id).length +
      result.cityIds.filter((c) => citySegment[c] && citySegment[c] !== segment.id).length
    : 0;
  const total = result ? result.zips.length + result.cityIds.length : 0;

  const add = () => {
    if (!result) return;
    assign('zip', result.zips, segment.id);
    assign('city', result.cityIds, segment.id);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      // autoFocus loses to the dialog's focus trap, so focus once the dialog is shown.
      slotProps={{ transition: { onEntered: () => textRef.current?.focus() } }}
    >
      <DialogTitle>Add areas to {segment.name}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Paste ZIP codes (separated by commas, spaces or new lines) and cities (one per line, like
          &ldquo;Austin, TX&rdquo;).
        </DialogContentText>
        <TextField
          inputRef={textRef}
          fullWidth
          multiline
          minRows={6}
          maxRows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'02134, 02135, 02215\nAustin, TX\nSpringfield, Illinois'}
          slotProps={{ htmlInput: { 'aria-label': 'ZIP codes and cities', spellCheck: false } }}
        />
        {result && text.trim() && (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1}>
              <Chip color="primary" variant="outlined" label={pluralize(result.zips.length, 'ZIP code')} />
              <Chip color="primary" variant="outlined" label={pluralize(result.cityIds.length, 'city', 'cities')} />
            </Stack>
            {moving > 0 && (
              <Alert severity="info">
                {pluralize(moving, 'area')} will move here from other segments. An area can only be in one segment.
              </Alert>
            )}
            {result.unmatched.length > 0 && (
              <Alert severity="warning">
                {pluralize(result.unmatched.length, 'entry', 'entries')} didn&rsquo;t match a ZIP code or city:{' '}
                {result.unmatched.slice(0, 15).join(', ')}
                {result.unmatched.length > 15 && `, and ${result.unmatched.length - 15} more`}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={total === 0} onClick={add}>
          {total > 0 ? `Add ${pluralize(total, 'area')}` : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
