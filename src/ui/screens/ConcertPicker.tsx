import { Box, Text, useWindowSize } from 'ink';
import { useState } from 'react';

import { formatLocation, getSongs, toIsoDate } from '../../setlist.ts';
import type { Concert } from '../../setlist.ts';
import { KeyHints } from '../components/KeyHints.tsx';
import { Select } from '../components/Select.tsx';
import { theme } from '../theme.ts';

type Props = {
  concerts: Array<Concert>;
  onSubmit: (concert: Concert) => void;
  onCancel: () => void;
};

export function ConcertPicker({ concerts, onSubmit, onCancel }: Props) {
  const [highlighted, setHighlighted] = useState(concerts[0]!);
  const { columns, rows } = useWindowSize();
  const limit = Math.max(5, Math.min(14, rows - 12));
  const showPreview = columns >= 100;

  return (
    <Box flexDirection="column">
      <Text>
        Found <Text color={theme.accent}>{concerts.length}</Text> setlists for{' '}
        <Text bold>{concerts[0]!.artist.name}</Text>
      </Text>
      <Box gap={2}>
        <Box flexDirection="column" width={showPreview ? '55%' : '100%'}>
          <Select
            items={concerts}
            limit={limit}
            onSubmit={onSubmit}
            onHighlight={setHighlighted}
            onCancel={onCancel}
            renderItem={(concert, isSelected) => (
              <Text wrap="truncate-end">
                <Text color={theme.muted}>{toIsoDate(concert.eventDate)} </Text>
                <Text bold={isSelected} color={isSelected ? theme.accent : undefined}>
                  {formatLocation(concert)}
                </Text>
                <Text color={theme.muted}> · {getSongs(concert).length} songs</Text>
              </Text>
            )}
          />
        </Box>
        {showPreview && <SetlistPreview concert={highlighted} maxSongs={limit} />}
      </Box>
      <KeyHints
        hints={[
          ['↑↓', 'navigate'],
          ['enter', 'select'],
          ['esc', 'new search'],
        ]}
      />
    </Box>
  );
}

function SetlistPreview({ concert, maxSongs }: { concert: Concert; maxSongs: number }) {
  const songs = getSongs(concert);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={theme.muted}
      paddingX={1}
    >
      <Text bold wrap="truncate-end">
        {concert.tour?.name ?? 'Setlist'}
      </Text>
      {songs.slice(0, maxSongs).map((song, index) => (
        <Text key={index} wrap="truncate-end">
          <Text color={theme.muted}>{String(index + 1).padStart(2)}. </Text>
          {song.name}
          {song.cover && <Text color={theme.muted}> ({song.cover.name} cover)</Text>}
        </Text>
      ))}
      {songs.length > maxSongs && (
        <Text color={theme.muted}> …and {songs.length - maxSongs} more</Text>
      )}
    </Box>
  );
}
