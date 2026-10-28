import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import type { ConcertQuery } from '../../setlist.ts';
import { KeyHints } from '../components/KeyHints.tsx';
import { TextInput } from '../components/TextInput.tsx';
import { theme } from '../theme.ts';

type Props = {
  initialQuery?: ConcertQuery;
  notice?: string;
  onSubmit: (query: ConcertQuery) => void;
};

export function SearchForm({ initialQuery, notice, onSubmit }: Props) {
  const [artistName, setArtistName] = useState(initialQuery?.artistName ?? '');
  const [year, setYear] = useState(initialQuery?.year ? String(initialQuery.year) : '');
  const [field, setField] = useState<'artist' | 'year'>('artist');
  const [error, setError] = useState<string>();

  useInput((_input, key) => {
    if (key.tab || key.upArrow || key.downArrow) {
      setField((current) => (current === 'artist' ? 'year' : 'artist'));
    }
  });

  const submit = () => {
    if (!artistName.trim()) {
      setField('artist');
      return;
    }
    const currentYear = new Date().getFullYear();
    if (year && (year.length !== 4 || Number(year) < 1900 || Number(year) > currentYear)) {
      setField('year');
      setError(`Enter a year between 1900 and ${currentYear}, or leave it empty.`);
      return;
    }
    setError(undefined);
    onSubmit({ artistName: artistName.trim(), year: year ? Number(year) : undefined });
  };

  return (
    <Box flexDirection="column">
      {notice && <Text color={theme.warning}>{notice}</Text>}
      <Text bold>Which artist did you see?</Text>
      <TextInput
        value={artistName}
        onChange={setArtistName}
        onSubmit={submit}
        placeholder="e.g. Radiohead"
        isActive={field === 'artist'}
      />
      <Box marginTop={1}>
        <Text bold>Year </Text>
        <Text color={theme.muted}>(optional)</Text>
      </Box>
      <TextInput
        value={year}
        onChange={(value) => {
          setYear(value);
          setError(undefined);
        }}
        onSubmit={submit}
        placeholder="any year"
        isActive={field === 'year'}
        allow={/^\d+$/}
        maxLength={4}
      />
      {error && <Text color={theme.error}>{error}</Text>}
      <KeyHints
        hints={[
          ['tab', field === 'artist' ? 'year' : 'artist'],
          ['enter', 'search'],
          ['ctrl+c', 'quit'],
        ]}
      />
    </Box>
  );
}
