import { Box, Text } from 'ink';

import type { Match } from '../../playlist.ts';
import type { Song } from '../../setlist.ts';
import { theme } from '../theme.ts';

type Props = {
  songs: Array<Song>;
  /** Sparse while matching is in progress. */
  matches: Array<Match | undefined>;
  limit: number;
};

/** Lists songs with their Spotify match status, keeping the most recent matches in view. */
export function MatchList({ songs, matches, limit }: Props) {
  const lastDone = matches.findLastIndex(Boolean);
  const offset = Math.max(0, Math.min(lastDone - limit + 2, songs.length - limit));

  return (
    <Box flexDirection="column">
      {songs.slice(offset, offset + limit).map((song, visibleIndex) => {
        const match = matches[offset + visibleIndex];
        const artists = match?.track?.artists.map((artist) => artist.name).join(', ');

        return (
          <Text key={offset + visibleIndex} wrap="truncate-end">
            {!match ? (
              <Text color={theme.muted}>· </Text>
            ) : match.track ? (
              <Text color={theme.accent}>✓ </Text>
            ) : (
              <Text color={theme.error}>✗ </Text>
            )}
            <Text color={match ? undefined : theme.muted}>{song.name}</Text>
            {match?.track && (
              <Text color={theme.muted}>
                {'  '}→ {match.track.name} · {artists}
              </Text>
            )}
            {match && !match.track && <Text color={theme.error}> not found on Spotify</Text>}
          </Text>
        );
      })}
      {offset + limit < songs.length && (
        <Text color={theme.muted}> …and {songs.length - offset - limit} more</Text>
      )}
    </Box>
  );
}
