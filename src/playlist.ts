import { renderCover } from './cover/cover.tsx';
import { formatLocation, getPlaylistName, getSongs, toIsoDate } from './setlist.ts';
import type { Concert, Song } from './setlist.ts';
import type { SpotifyClient, Track } from './spotify/client.ts';

export type Match = {
  song: Song;
  track?: Track;
  /** Set when the song was left out by hand rather than not found. */
  skipped?: boolean;
};

/**
 * Looks up every song of the concert on Spotify, a few at a time, reporting each match as it
 * comes in. Covers are searched under the original artist.
 */
export async function matchSongs(
  spotify: SpotifyClient,
  concert: Concert,
  onMatch: (match: Match, index: number) => void,
  concurrency = 4,
): Promise<Array<Match>> {
  const songs = getSongs(concert);
  const matches: Array<Match> = Array.from({ length: songs.length });
  let next = 0;

  const worker = async () => {
    while (next < songs.length) {
      const index = next++;
      matches[index] = await matchSong(spotify, concert, songs[index]!);
      onMatch(matches[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, songs.length) }, worker));

  return matches;
}

/** Looks up a single song on Spotify, searching covers under the original artist. */
export async function matchSong(
  spotify: SpotifyClient,
  concert: Concert,
  song: Song,
): Promise<Match> {
  return {
    song,
    track: await spotify.searchTrack(song.name, song.cover?.name ?? concert.artist.name),
  };
}

export type PlaylistOptions = {
  /**
   * The setlist.fm concert, when `concert` has edited details (e.g. a show with the same setlist
   * that isn't on setlist.fm). The description then credits the original setlist.
   */
  basedOn?: Concert;
  /**
   * A playlist to get to know the songs before an upcoming show: `concert` is that show and its
   * songs are the ones `basedOn` (or `concert` itself) played, as a prediction.
   */
  preShow?: boolean;
};

export async function createSetlistPlaylist(
  spotify: SpotifyClient,
  concert: Concert,
  matches: Array<Match>,
  onStep: (step: string) => void,
  options: PlaylistOptions = {},
): Promise<string> {
  const { preShow = false } = options;
  onStep('Creating playlist');
  const playlist = await spotify.createPlaylist(
    getPlaylistName(concert, preShow),
    getDescription(concert, options),
  );

  onStep('Adding tracks');
  await spotify.addItems(
    playlist.id,
    matches.flatMap((match) => (match.track ? [match.track.uri] : [])),
  );

  onStep('Uploading cover');
  try {
    await spotify.uploadCover(playlist.id, await renderCover(concert, matches, options));
  } catch {
    // A missing cover is not worth failing the whole playlist for.
  }

  return playlist.url;
}

function getDescription(concert: Concert, { basedOn, preShow }: PlaylistOptions): string {
  const source = basedOn ?? concert;
  const credit = `the setlist of ${source.artist.name} at ${formatLocation(source)} on ${toIsoDate(source.eventDate)}. ${source.url}`;

  if (preShow) {
    return `Predicted setlist for ${concert.artist.name} at ${formatLocation(concert)} on ${toIsoDate(concert.eventDate)}, based on ${credit}`;
  }
  return basedOn
    ? `Based on ${credit}`
    : `Setlist of ${concert.artist.name} at ${formatLocation(concert)}. ${concert.url}`;
}
