import { Box, Text } from 'ink';

import type { Match } from '../../playlist.ts';
import { splitMedley } from '../../setlist.ts';
import type { Song } from '../../setlist.ts';
import { theme } from '../theme.ts';

type Props = {
  songs: Array<Song>;
  /** Sparse while matching is in progress. */
  matches: Array<Match | undefined>;
  limit: number;
  /** Shows a cursor on this song and keeps it in view. */
  selectedIndex?: number;
};

/**
 * Lists songs with their Spotify match status, keeping the selected song or, while matching, the
 * most recent matches in view.
 */
export function MatchList({ songs, matches, limit, selectedIndex }: Props) {
  const focusIndex =
    selectedIndex === undefined
      ? matches.findLastIndex(Boolean) - limit + 2
      : selectedIndex - Math.floor(limit / 2);
  const offset = Math.max(0, Math.min(focusIndex, songs.length - limit));

  return (
    <Box flexDirection="column">
      {songs.slice(offset, offset + limit).map((song, visibleIndex) => {
        const match = matches[offset + visibleIndex];
        const isSelected = offset + visibleIndex === selectedIndex;
        const artists = match?.track?.artists.map((artist) => artist.name).join(', ');

        return (
          <Text key={offset + visibleIndex} wrap="truncate-end">
            {selectedIndex !== undefined && (
              <Text color={theme.accent}>{isSelected ? '❯ ' : '  '}</Text>
            )}
            {!match ? (
              <Text color={theme.muted}>· </Text>
            ) : match.track ? (
              <Text color={theme.accent}>✓ </Text>
            ) : (
              <Text color={theme.error}>✗ </Text>
            )}
            <Text bold={isSelected} color={match ? undefined : theme.muted}>
              {song.name}
            </Text>
            {splitMedley(song).length > 1 && <Text color={theme.warning}> [medley]</Text>}
            {match?.track && (
              <Text color={theme.muted}>
                {'  '}→ {match.track.name} · {artists}
              </Text>
            )}
            {match && !match.track && (
              <Text color={theme.error}>
                {match.skipped ? ' left out' : ' not found on Spotify'}
              </Text>
            )}
          </Text>
        );
      })}
      {offset + limit < songs.length && (
        <Text color={theme.muted}> …and {songs.length - offset - limit} more</Text>
      )}
    </Box>
  );
}
