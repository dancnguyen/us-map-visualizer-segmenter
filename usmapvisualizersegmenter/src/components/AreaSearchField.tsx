import { useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import MarkunreadMailboxIcon from '@mui/icons-material/MarkunreadMailbox';
import SearchIcon from '@mui/icons-material/Search';
import { useGeoData } from '../data/geoData';
import type { SearchResult } from '../lib/search';
import { resultName, searchAreas } from '../lib/search';

interface Props {
  /** Controlled value; leave undefined to let the field manage it */
  value?: SearchResult | null;
  onChange: (result: SearchResult | null) => void;
  label?: string;
  placeholder?: string;
  sx?: SxProps<Theme>;
}

/** Type-ahead for ZIP codes and cities. */
export default function AreaSearchField({ value, onChange, label, placeholder = 'Search ZIP code or city', sx }: Props) {
  const geo = useGeoData((s) => s.data);
  const [input, setInput] = useState('');
  const options = useMemo(() => (geo ? searchAreas(geo, input) : []), [geo, input]);

  return (
    <Autocomplete<SearchResult>
      size="small"
      disabled={!geo}
      {...(value !== undefined && { value })}
      options={options}
      filterOptions={(o) => o}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.kind === b.kind && a.key === b.key}
      inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, result) => onChange(result)}
      noOptionsText={input ? 'No matching ZIP code or city' : 'Type a ZIP code or city'}
      renderOption={({ key, ...props }, o) => (
        <li key={key} {...props}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {o.kind === 'zip' ? <MarkunreadMailboxIcon fontSize="small" /> : <LocationCityIcon fontSize="small" />}
          </ListItemIcon>
          <Typography variant="body2">{resultName(o)}</Typography>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      sx={sx}
    />
  );
}
