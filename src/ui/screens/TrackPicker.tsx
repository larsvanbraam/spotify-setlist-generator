import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

import type { Match } from '../../playlist.ts';
import type { SpotifyClient, Track } from '../../spotify/client.ts';
import { KeyHints } from '../components/KeyHints.tsx';
import { Select } from '../components/Select.tsx';
import { Spinner } from '../components/Spinner.tsx';
import { TextInput } from '../components/TextInput.tsx';
import { theme } from '../theme.ts';

const SKIP = 'skip';

type Props = {
  spotify: SpotifyClient;
  match: Match;
  artistName: string;
  limit: number;
  /** `undefined` leaves the song out of the playlist. */
  onSubmit: (track: Track | undefined) => void;
  onCancel: () => void;
};

/** Lets you search Spotify by hand for a song that wasn't (correctly) matched. */
export function TrackPicker({ spotify, match, artistName, limit, onSubmit, onCancel }: Props) {
  const [query, setQuery] = useState(`${match.song.name} ${artistName}`);
  const [results, setResults] = useState<Array<Track>>();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [focus, setFocus] = useState<'query' | 'results'>('results');

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(undefined);
    try {
      setResults(await spotify.searchTracks(query.trim()));
      setFocus('results');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  };

  // Start with results for the pre-filled query so a good match is one keypress away.
  useEffect(() => {
    void search();
  }, []);

  useInput((_input, key) => {
    if (key.tab) setFocus((current) => (current === 'query' ? 'results' : 'query'));
    else if (key.escape && focus === 'query') onCancel();
  });

  const items: Array<Track | typeof SKIP> = [...(results ?? []), SKIP];

  return (
    <Box flexDirection="column">
      <Text>
        Pick a track for <Text bold>{match.song.name}</Text>
        {match.song.cover && <Text color={theme.muted}> ({match.song.cover.name} cover)</Text>}
      </Text>
      <Box marginTop={1}>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={() => void search()}
          placeholder="Search Spotify"
          isActive={focus === 'query'}
        />
      </Box>
      {searching ? (
        <Box marginTop={1}>
          <Spinner label="Searching Spotify…" />
        </Box>
      ) : (
        <>
          {results?.length === 0 && (
            <Text color={theme.warning}>No tracks found, try another search.</Text>
          )}
          <Select
            // Remount on new results so the cursor starts at the top.
            key={results?.map((track) => track.uri).join()}
            items={items}
            limit={limit}
            isActive={focus === 'results'}
            onSubmit={(item) => onSubmit(item === SKIP ? undefined : item)}
            onCancel={onCancel}
            renderItem={(item, isSelected) =>
              item === SKIP ? (
                <Text bold={isSelected} color={isSelected ? theme.accent : theme.muted}>
                  Leave this song out of the playlist
                </Text>
              ) : (
                <Text wrap="truncate-end">
                  <Text bold={isSelected} color={isSelected ? theme.accent : undefined}>
                    {item.name}
                  </Text>
                  <Text color={theme.muted}>
                    {' '}
                    · {item.artists.map((artist) => artist.name).join(', ')} · {item.album.name}
                  </Text>
                </Text>
              )
            }
          />
        </>
      )}
      {error && <Text color={theme.error}>✗ {error}</Text>}
      <KeyHints
        hints={
          focus === 'query'
            ? [
                ['enter', 'search'],
                ['tab', 'results'],
                ['esc', 'back'],
              ]
            : [
                ['↑↓', 'navigate'],
                ['enter', 'pick'],
                ['tab', 'edit search'],
                ['esc', 'back'],
              ]
        }
      />
    </Box>
  );
}
