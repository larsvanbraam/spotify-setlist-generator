import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { useEffect, useState } from 'react';

import type { Env } from '../env.ts';
import { createSetlistPlaylist, matchSongs } from '../playlist.ts';
import type { Match } from '../playlist.ts';
import {
  formatLocation,
  getPlaylistName,
  getSongs,
  searchConcerts,
  toIsoDate,
} from '../setlist.ts';
import type { Concert } from '../setlist.ts';
import { authenticate } from '../spotify/auth.ts';
import { SpotifyClient } from '../spotify/client.ts';
import { Header } from './components/Header.tsx';
import { KeyHints } from './components/KeyHints.tsx';
import { ProgressBar } from './components/ProgressBar.tsx';
import { Spinner } from './components/Spinner.tsx';
import { TextInput } from './components/TextInput.tsx';
import { ConcertPicker } from './screens/ConcertPicker.tsx';
import { MatchList } from './screens/MatchList.tsx';
import { theme } from './theme.ts';

type Screen =
  | { name: 'auth'; loginUrl?: string }
  | { name: 'search'; notice?: string }
  | { name: 'loading'; label: string }
  | { name: 'concerts'; concerts: Array<Concert> }
  | { name: 'matching'; concert: Concert; matches: Array<Match | undefined> }
  | { name: 'review'; concert: Concert; matches: Array<Match> }
  | { name: 'creating'; concert: Concert; step: string }
  | { name: 'done'; concert: Concert; matches: Array<Match>; url: string }
  | { name: 'error'; message: string };

export function App({
  env,
  onPlaylistCreated,
}: {
  env: Env;
  onPlaylistCreated: (url: string) => void;
}) {
  const [screen, setScreen] = useState<Screen>({ name: 'auth' });
  const [spotify, setSpotify] = useState<SpotifyClient>();
  const [concerts, setConcerts] = useState<Array<Concert>>([]);
  const { exit } = useApp();
  const { rows } = useWindowSize();
  const listLimit = Math.max(5, Math.min(16, rows - 12));

  const fail = (error: unknown) =>
    setScreen({ name: 'error', message: error instanceof Error ? error.message : String(error) });

  useEffect(() => {
    authenticate({
      clientId: env.spotifyClientId,
      redirectUri: env.spotifyRedirectUri,
      onLoginRequired: (loginUrl) => setScreen({ name: 'auth', loginUrl }),
    })
      .then((token) => {
        setSpotify(new SpotifyClient(token));
        setScreen({ name: 'search' });
      })
      .catch(fail);
  }, []);

  const search = async (artistName: string) => {
    setScreen({ name: 'loading', label: `Searching setlist.fm for “${artistName}”` });
    try {
      const results = await searchConcerts(artistName, env.setlistApiKey);
      if (results.length === 0) {
        setScreen({ name: 'search', notice: `No past setlists found for “${artistName}”.` });
        return;
      }
      setConcerts(results);
      setScreen({ name: 'concerts', concerts: results });
    } catch (error) {
      fail(error);
    }
  };

  const match = async (concert: Concert) => {
    const matches: Array<Match | undefined> = Array.from({ length: getSongs(concert).length });
    setScreen({ name: 'matching', concert, matches: [...matches] });
    try {
      const result = await matchSongs(spotify!, concert, (match, index) => {
        matches[index] = match;
        setScreen({ name: 'matching', concert, matches: [...matches] });
      });
      setScreen({ name: 'review', concert, matches: result });
    } catch (error) {
      fail(error);
    }
  };

  const create = async (concert: Concert, matches: Array<Match>) => {
    setScreen({ name: 'creating', concert, step: 'Creating playlist' });
    try {
      const url = await createSetlistPlaylist(spotify!, concert, matches, (step) =>
        setScreen({ name: 'creating', concert, step }),
      );
      onPlaylistCreated(url);
      setScreen({ name: 'done', concert, matches, url });
    } catch (error) {
      fail(error);
    }
  };

  useInput(
    (input, key) => {
      if (input === 'q') return exit();
      if (screen.name === 'review') {
        if (key.return && screen.matches.some((match) => match.track)) {
          void create(screen.concert, screen.matches);
        }
        if (key.escape) setScreen({ name: 'concerts', concerts });
      }
      if (screen.name === 'done' && input === 'n') setScreen({ name: 'search' });
      if (screen.name === 'error' && (key.return || key.escape)) {
        // Without a Spotify session there is nothing to go back to.
        if (spotify) setScreen({ name: 'search' });
        else exit();
      }
    },
    { isActive: ['review', 'done', 'error'].includes(screen.name) },
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header subtitle="Turn any setlist.fm concert into a Spotify playlist" />

      {screen.name === 'auth' &&
        (screen.loginUrl ? (
          <Box flexDirection="column" gap={1}>
            <Spinner label="Waiting for you to log in to Spotify in your browser…" />
            <Text color={theme.muted}>
              Browser didn’t open? Visit:{'\n'}
              <Text color={theme.accentAlt}>{screen.loginUrl}</Text>
            </Text>
          </Box>
        ) : (
          <Spinner label="Connecting to Spotify…" />
        ))}

      {screen.name === 'search' && (
        <Box flexDirection="column">
          {screen.notice && <Text color={theme.warning}>{screen.notice}</Text>}
          <Text bold>Which artist did you see?</Text>
          <TextInput placeholder="e.g. Radiohead" onSubmit={search} />
          <KeyHints
            hints={[
              ['enter', 'search'],
              ['ctrl+c', 'quit'],
            ]}
          />
        </Box>
      )}

      {screen.name === 'loading' && <Spinner label={screen.label} />}

      {screen.name === 'concerts' && (
        <ConcertPicker
          concerts={screen.concerts}
          onSubmit={match}
          onCancel={() => setScreen({ name: 'search' })}
        />
      )}

      {(screen.name === 'matching' || screen.name === 'review') && (
        <Box flexDirection="column">
          <ConcertTitle concert={screen.concert} />
          <Box marginY={1}>
            <ProgressBar
              value={screen.matches.filter(Boolean).length}
              total={screen.matches.length}
            />
          </Box>
          <MatchList songs={getSongs(screen.concert)} matches={screen.matches} limit={listLimit} />
          {screen.name === 'matching' ? (
            <Box marginTop={1}>
              <Spinner label="Finding songs on Spotify…" />
            </Box>
          ) : (
            <ReviewSummary matches={screen.matches} />
          )}
        </Box>
      )}

      {screen.name === 'creating' && (
        <Box flexDirection="column" gap={1}>
          <ConcertTitle concert={screen.concert} />
          <Spinner label={`${screen.step}…`} />
        </Box>
      )}

      {screen.name === 'done' && (
        <Box flexDirection="column">
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={theme.accent}
            paddingX={2}
            paddingY={1}
            alignSelf="flex-start"
          >
            <Text color={theme.accent} bold>
              ✓ Playlist created
            </Text>
            <Text>{getPlaylistName(screen.concert)}</Text>
            <Text color={theme.muted}>
              {screen.matches.filter((match) => match.track).length} tracks ·{' '}
              <Text color={theme.accentAlt}>{screen.url}</Text>
            </Text>
          </Box>
          <KeyHints
            hints={[
              ['n', 'new playlist'],
              ['q', 'quit'],
            ]}
          />
        </Box>
      )}

      {screen.name === 'error' && (
        <Box flexDirection="column">
          <Box borderStyle="round" borderColor={theme.error} paddingX={2} alignSelf="flex-start">
            <Text color={theme.error}>✗ {screen.message}</Text>
          </Box>
          <KeyHints
            hints={[
              ['enter', spotify ? 'back to search' : 'quit'],
              ['q', 'quit'],
            ]}
          />
        </Box>
      )}
    </Box>
  );
}

function ConcertTitle({ concert }: { concert: Concert }) {
  return (
    <Text>
      <Text bold>{concert.artist.name}</Text>
      <Text color={theme.muted}> @ </Text>
      {formatLocation(concert)}
      <Text color={theme.muted}> · {toIsoDate(concert.eventDate)}</Text>
    </Text>
  );
}

function ReviewSummary({ matches }: { matches: Array<Match> }) {
  const found = matches.filter((match) => match.track).length;
  const missing = matches.length - found;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text color={theme.accent} bold>
          {found}
        </Text>{' '}
        of {matches.length} songs found on Spotify
        {missing > 0 && <Text color={theme.error}> · {missing} missing</Text>}
      </Text>
      <KeyHints
        hints={[
          ...(found > 0 ? [['enter', 'create playlist'] as [string, string]] : []),
          ['esc', 'pick another concert'],
          ['q', 'quit'],
        ]}
      />
    </Box>
  );
}
