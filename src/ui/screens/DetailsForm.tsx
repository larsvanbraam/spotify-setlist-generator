import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import type { ConcertDetails } from '../../setlist.ts';
import { KeyHints } from '../components/KeyHints.tsx';
import { TextInput } from '../components/TextInput.tsx';
import { theme } from '../theme.ts';

const FIELDS: Array<{ key: keyof ConcertDetails; label: string }> = [
  { key: 'artistName', label: 'Artist' },
  { key: 'venueName', label: 'Venue' },
  { key: 'cityName', label: 'City' },
  { key: 'countryName', label: 'Country' },
  { key: 'date', label: 'Date (yyyy-mm-dd)' },
];

type Props = {
  /** The details from setlist.fm, used for empty fields. */
  original: ConcertDetails;
  details: ConcertDetails;
  onSubmit: (details: ConcertDetails) => void;
  onCancel: () => void;
};

/** Edits the details the playlist name, description and cover are made from. */
export function DetailsForm({ original, details, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState(details);
  const [field, setField] = useState(0);
  const [error, setError] = useState<string>();

  useInput((_input, key) => {
    const step = key.tab || key.downArrow ? 1 : key.upArrow ? -1 : 0;
    if (step) setField((current) => (current + step + FIELDS.length) % FIELDS.length);
    else if (key.escape) onCancel();
  });

  const submit = () => {
    // An empty field falls back to the setlist.fm value.
    const result = Object.fromEntries(
      FIELDS.map(({ key }) => [key, values[key].trim() || original[key]]),
    ) as ConcertDetails;

    if (!isValidDate(result.date)) {
      setField(FIELDS.findIndex(({ key }) => key === 'date'));
      setError('Enter the date as yyyy-mm-dd, e.g. 2018-10-28.');
      return;
    }
    onSubmit(result);
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>Concert details</Text>
      <Text color={theme.muted}>
        The playlist name, description and cover are made from these. Empty fields use the
        setlist.fm value.
      </Text>
      {FIELDS.map(({ key, label }, index) => (
        <Box key={key}>
          <Box width={20}>
            <Text color={index === field ? undefined : theme.muted}>{label}</Text>
          </Box>
          <TextInput
            value={values[key]}
            onChange={(value) => {
              setValues((current) => ({ ...current, [key]: value }));
              setError(undefined);
            }}
            onSubmit={submit}
            placeholder={original[key]}
            isActive={index === field}
            {...(key === 'date' ? { allow: /^[\d-]+$/, maxLength: 10 } : {})}
          />
        </Box>
      ))}
      {error && <Text color={theme.error}>{error}</Text>}
      <KeyHints
        hints={[
          ['tab', 'next field'],
          ['enter', 'save'],
          ['esc', 'cancel'],
        ]}
      />
    </Box>
  );
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  // Rejects dates like 2018-02-31, which Date would roll over into March.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}
