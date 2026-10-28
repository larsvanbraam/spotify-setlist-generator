import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { useEffect, useState } from 'react';

import type { Env } from '../env.ts';
import { createSetlistPlaylist, matchSong, matchSongs } from '../playlist.ts';
import type { Match, PlaylistOptions } from '../playlist.ts';
import {
  formatFilters,
  formatLocation,
  getDetails,
  getPlaylistName,
  getSongs,
  searchConcerts,
  splitMedley,
  toIsoDate,
  withDetails,
} from '../setlist.ts';
import type { Concert, ConcertDetails, ConcertQuery } from '../setlist.ts';
import { authenticate, refreshToken } from '../spotify/auth.ts';
import { SpotifyClient } from '../spotify/client.ts';
import { Header } from './components/Header.tsx';
import { KeyHints } from './components/KeyHints.tsx';
import { ProgressBar } from './components/ProgressBar.tsx';
import { Spinner } from './components/Spinner.tsx';
import { ConcertPicker } from './screens/ConcertPicker.tsx';
import { DetailsForm } from './screens/DetailsForm.tsx';
import { MatchList } from './screens/MatchList.tsx';
import { SearchForm } from './screens/SearchForm.tsx';
import { TrackPicker } from './screens/TrackPicker.tsx';
import { theme } from './theme.ts';

type Screen =
  | { name: 'auth'; loginUrl?: string }
  | { name: 'search'; notice?: string }
  | { name: 'loading'; label: string }
  | { name: 'concerts' }
  | { name: 'matching'; concert: Concert; matches: Array<Match | undefined> }
  | {
      name: 'review';
      concert: Concert;
      matches: Array<Match>;
      index: number;
      /** Set while a medley's songs are being looked up. */
      splitting?: boolean;
    }
  | { name: 'pick'; concert: Concert; matches: Array<Match>; index: number }
  | { name: 'creating'; concert: Concert; step: string }
  | { name: 'done'; title: string; matches: Array<Match>; url: string }
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
  const [query, setQuery] = useState<ConcertQuery>();
  const [concerts, setConcerts] = useState<Array<Concert>>([]);
  const [nextPage, setNextPage] = useState<number>();
  /** Edited concert details for the playlist, `undefined` uses the ones from setlist.fm. */
  const [details, setDetails] = useState<ConcertDetails>();
  const [editingDetails, setEditingDetails] = useState(false);
  /** Makes a playlist to get to know a predicted setlist before an upcoming show. */
  const [preShow, setPreShow] = useState(false);
  /** The concert as it ends up in the playlist name, description and cover. */
  const forPlaylist = (concert: Concert) => (details ? withDetails(concert, details) : concert);
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
        setSpotify(new SpotifyClient(token, (token) => refreshToken(env.spotifyClientId, token)));
        setScreen({ name: 'search' });
      })
      .catch(fail);
  }, []);

  const search = async (query: ConcertQuery) => {
    const description = `“${query.artistName}”${formatFilters(query)}`;
    setQuery(query);
    setScreen({ name: 'loading', label: `Searching setlist.fm for ${description}` });
    try {
      const results = await searchConcerts(query, env.setlistApiKey);
      if (results.concerts.length === 0) {
        setScreen({
          name: 'search',
          notice:
            `No past setlists found for ${description}.` +
            // setlist.fm only matches complete city names.
            (query.cityName ? ' Check that the city is spelled out in full.' : ''),
        });
        return;
      }
      setConcerts(results.concerts);
      setNextPage(results.nextPage);
      setScreen({ name: 'concerts' });
    } catch (error) {
      fail(error);
    }
  };

  const loadMore = async () => {
    if (!query || !nextPage) return [];
    const results = await searchConcerts(query, env.setlistApiKey, nextPage);
    setConcerts((current) => [...current, ...results.concerts]);
    setNextPage(results.nextPage);
    return results.concerts;
  };

  const match = async (concert: Concert) => {
    const matches: Array<Match | undefined> = Array.from({ length: getSongs(concert).length });
    setScreen({ name: 'matching', concert, matches: [...matches] });
    try {
      const result = await matchSongs(spotify!, concert, (match, index) => {
        matches[index] = match;
        setScreen({ name: 'matching', concert, matches: [...matches] });
      });
      setDetails(undefined);
      setPreShow(false);
      // Start on the first missing song, that's the one you most likely want to fix.
      const firstMissing = result.findIndex((match) => !match.track);
      setScreen({ name: 'review', concert, matches: result, index: Math.max(0, firstMissing) });
    } catch (error) {
      fail(error);
    }
  };

  /** Replaces the medley at `index` with its individual songs, each matched on Spotify. */
  const split = async (concert: Concert, index: number, match: Match) => {
    const songs = splitMedley(match.song);
    if (songs.length < 2) return;
    setScreen((current) => (current.name === 'review' ? { ...current, splitting: true } : current));
    try {
      const parts = await Promise.all(songs.map((song) => matchSong(spotify!, concert, song)));
      setScreen((current) =>
        current.name === 'review'
          ? { ...current, splitting: false, matches: current.matches.toSpliced(index, 1, ...parts) }
          : current,
      );
    } catch (error) {
      fail(error);
    }
  };

  const create = async (concert: Concert, matches: Array<Match>, options: PlaylistOptions) => {
    setScreen({ name: 'creating', concert, step: 'Creating playlist' });
    try {
      const url = await createSetlistPlaylist(
        spotify!,
        concert,
        matches,
        (step) => setScreen({ name: 'creating', concert, step }),
        options,
      );
      onPlaylistCreated(url);
      setScreen({
        name: 'done',
        title: getPlaylistName(concert, options.preShow),
        matches,
        url,
      });
    } catch (error) {
      fail(error);
    }
  };

  useInput(
    (input, key) => {
      if (input === 'q') return exit();
      if (screen.name === 'review' && !screen.splitting) {
        // Update from the latest screen, key repeat can fire several times before a re-render.
        const move = (delta: number) =>
          setScreen((current) =>
            current.name === 'review'
              ? {
                  ...current,
                  index: Math.max(0, Math.min(current.matches.length - 1, current.index + delta)),
                }
              : current,
          );
        if (key.upArrow || input === 'k') move(-1);
        if (key.downArrow || input === 'j') move(1);
        if (key.return) setScreen({ ...screen, name: 'pick' });
        if (input === 's') void split(screen.concert, screen.index, screen.matches[screen.index]!);
        if (input === 'e') setEditingDetails(true);
        if (input === 'p') {
          // The upcoming show is somewhere else, so ask for its details right away.
          if (!preShow) setEditingDetails(true);
          setPreShow(!preShow);
        }
        if (input === 'c' && screen.matches.some((match) => match.track)) {
          void create(forPlaylist(screen.concert), screen.matches, {
            basedOn: details || preShow ? screen.concert : undefined,
            preShow,
          });
        }
        if (key.escape) setScreen({ name: 'concerts' });
      }
      if (screen.name === 'done' && input === 'n') {
        // A new playlist starts from an empty form; going back from other screens keeps the query.
        setQuery(undefined);
        setScreen({ name: 'search' });
      }
      if (screen.name === 'error' && (key.return || key.escape)) {
        // Without a Spotify session there is nothing to go back to.
        if (spotify) setScreen({ name: 'search' });
        else exit();
      }
    },
    { isActive: ['review', 'done', 'error'].includes(screen.name) && !editingDetails },
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
        <SearchForm initialQuery={query} notice={screen.notice} onSubmit={search} />
      )}

      {screen.name === 'loading' && <Spinner label={screen.label} />}

      {screen.name === 'concerts' && (
        <ConcertPicker
          concerts={concerts}
          query={query!}
          hasMore={nextPage !== undefined}
          onSubmit={match}
          onCancel={() => setScreen({ name: 'search' })}
          onLoadMore={loadMore}
        />
      )}

      {screen.name === 'pick' && (
        <TrackPicker
          spotify={spotify!}
          match={screen.matches[screen.index]!}
          artistName={screen.matches[screen.index]!.song.cover?.name ?? screen.concert.artist.name}
          limit={listLimit}
          onSubmit={(track) => {
            const matches = screen.matches.with(screen.index, {
              song: screen.matches[screen.index]!.song,
              track,
              skipped: !track,
            });
            setScreen({ ...screen, name: 'review', matches });
          }}
          onCancel={() => setScreen({ ...screen, name: 'review' })}
        />
      )}

      {(screen.name === 'matching' || screen.name === 'review') && (
        <Box flexDirection="column">
          <ConcertTitle concert={forPlaylist(screen.concert)} />
          {screen.name === 'review' && (
            <Text>
              <Text color={theme.muted}>Playlist: </Text>
              {getPlaylistName(forPlaylist(screen.concert), preShow)}
              {(details || preShow) && (
                <Text color={theme.muted}>
                  {' '}
                  ({preShow ? 'predicted' : 'edited'}, based on {screen.concert.venue.name} ·{' '}
                  {toIsoDate(screen.concert.eventDate)})
                </Text>
              )}
            </Text>
          )}
          <Box marginY={1}>
            <ProgressBar
              value={screen.matches.filter(Boolean).length}
              total={screen.matches.length}
            />
          </Box>
          <MatchList
            songs={
              // Review can split medleys, so its songs come from the matches.
              screen.name === 'review'
                ? screen.matches.map((match) => match.song)
                : getSongs(screen.concert)
            }
            matches={screen.matches}
            limit={listLimit}
            selectedIndex={screen.name === 'review' ? screen.index : undefined}
          />
          {screen.name === 'matching' || screen.splitting ? (
            <Box marginTop={1}>
              <Spinner label="Finding songs on Spotify…" />
            </Box>
          ) : editingDetails ? (
            <DetailsForm
              title={preShow ? 'Upcoming show' : 'Concert details'}
              original={getDetails(screen.concert)}
              details={details ?? getDetails(screen.concert)}
              onSubmit={(edited) => {
                const original = getDetails(screen.concert);
                const changed = (Object.keys(original) as Array<keyof ConcertDetails>).some(
                  (key) => edited[key] !== original[key],
                );
                setDetails(changed ? edited : undefined);
                setEditingDetails(false);
              }}
              onCancel={() => setEditingDetails(false)}
            />
          ) : (
            <ReviewSummary
              matches={screen.matches}
              selected={screen.matches[screen.index]!}
              preShow={preShow}
            />
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
            <Text>{screen.title}</Text>
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

function ReviewSummary({
  matches,
  selected,
  preShow,
}: {
  matches: Array<Match>;
  selected: Match;
  preShow: boolean;
}) {
  const found = matches.filter((match) => match.track).length;
  const skipped = matches.filter((match) => match.skipped).length;
  const missing = matches.length - found - skipped;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text color={theme.accent} bold>
          {found}
        </Text>{' '}
        of {matches.length} songs found on Spotify
        {missing > 0 && <Text color={theme.error}> · {missing} missing</Text>}
        {skipped > 0 && <Text color={theme.muted}> · {skipped} left out</Text>}
      </Text>
      <KeyHints
        hints={[
          ['↑↓', 'navigate'],
          ['enter', 'change track'],
          ['e', 'edit details'],
          ['p', preShow ? 'regular playlist' : 'pre-show playlist'],
          ...(splitMedley(selected.song).length > 1
            ? [['s', 'split medley'] as [string, string]]
            : []),
          ...(found > 0 ? [['c', 'create playlist'] as [string, string]] : []),
          ['esc', 'pick another concert'],
          ['q', 'quit'],
        ]}
      />
    </Box>
  );
}
