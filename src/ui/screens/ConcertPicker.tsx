import { Box, Text, useInput, useWindowSize } from 'ink';
import { useState } from 'react';

import { formatLocation, getSongs, toIsoDate } from '../../setlist.ts';
import type { Concert } from '../../setlist.ts';
import { KeyHints } from '../components/KeyHints.tsx';
import { Select } from '../components/Select.tsx';
import { Spinner } from '../components/Spinner.tsx';
import { theme } from '../theme.ts';

const LOAD_MORE = 'load-more';

type Props = {
  concerts: Array<Concert>;
  year?: number;
  hasMore: boolean;
  onSubmit: (concert: Concert) => void;
  onCancel: () => void;
  /** Resolves with the newly loaded concerts. */
  onLoadMore: () => Promise<Array<Concert>>;
};

export function ConcertPicker({ concerts, year, hasMore, onSubmit, onCancel, onLoadMore }: Props) {
  const [highlighted, setHighlighted] = useState<Concert | typeof LOAD_MORE>(concerts[0]!);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const { columns, rows } = useWindowSize();
  const limit = Math.max(5, Math.min(14, rows - 12));
  const showPreview = columns >= 100;
  const items: Array<Concert | typeof LOAD_MORE> = hasMore ? [...concerts, LOAD_MORE] : concerts;

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError(undefined);
    try {
      const loaded = await onLoadMore();
      // A cursor on the "load more" row now sits on the first newly loaded concert.
      if (loaded[0]) {
        setHighlighted((current) => (current === LOAD_MORE ? loaded[0]! : current));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingMore(false);
    }
  };

  useInput((input) => {
    if (input === 'm' && hasMore) void loadMore();
  });

  const previewConcert = highlighted === LOAD_MORE ? undefined : highlighted;

  return (
    <Box flexDirection="column">
      <Text>
        Found <Text color={theme.accent}>{concerts.length}</Text>
        {hasMore && '+'} setlists for <Text bold>{concerts[0]!.artist.name}</Text>
        {year && <Text> in {year}</Text>}
      </Text>
      <Box gap={2}>
        <Box flexDirection="column" width={showPreview ? '55%' : '100%'}>
          <Select
            items={items}
            limit={limit}
            onSubmit={(item) => (item === LOAD_MORE ? void loadMore() : onSubmit(item))}
            onHighlight={setHighlighted}
            onCancel={onCancel}
            renderItem={(item, isSelected) =>
              item === LOAD_MORE ? (
                loadingMore ? (
                  <Spinner label="Loading older setlists…" />
                ) : (
                  <Text bold={isSelected} color={isSelected ? theme.accent : theme.muted}>
                    Load older setlists…
                  </Text>
                )
              ) : (
                <Text wrap="truncate-end">
                  <Text color={theme.muted}>{toIsoDate(item.eventDate)} </Text>
                  <Text bold={isSelected} color={isSelected ? theme.accent : undefined}>
                    {formatLocation(item)}
                  </Text>
                  <Text color={theme.muted}> · {getSongs(item).length} songs</Text>
                </Text>
              )
            }
          />
        </Box>
        {showPreview && previewConcert && (
          <SetlistPreview concert={previewConcert} maxSongs={limit} />
        )}
      </Box>
      {!hasMore && (
        <Text color={theme.muted}>No older setlists on setlist.fm{year && ` for ${year}`}.</Text>
      )}
      {error && <Text color={theme.error}>✗ {error}</Text>}
      <KeyHints
        hints={[
          ['↑↓', 'navigate'],
          ['enter', 'select'],
          ...(hasMore ? [['m', 'load more'] as [string, string]] : []),
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
