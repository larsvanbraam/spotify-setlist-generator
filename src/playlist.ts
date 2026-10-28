import { renderCover } from './cover/cover.tsx';
import { formatLocation, getPlaylistName, getSongs } from './setlist.ts';
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
      const song = songs[index]!;
      const track = await spotify.searchTrack(song.name, song.cover?.name ?? concert.artist.name);

      matches[index] = { song, track };
      onMatch(matches[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, songs.length) }, worker));

  return matches;
}

export async function createSetlistPlaylist(
  spotify: SpotifyClient,
  concert: Concert,
  matches: Array<Match>,
  onStep: (step: string) => void,
): Promise<string> {
  onStep('Creating playlist');
  const playlist = await spotify.createPlaylist(
    getPlaylistName(concert),
    `Setlist of ${concert.artist.name} at ${formatLocation(concert)}. ${concert.url}`,
  );

  onStep('Adding tracks');
  await spotify.addItems(
    playlist.id,
    matches.flatMap((match) => (match.track ? [match.track.uri] : [])),
  );

  onStep('Uploading cover');
  try {
    await spotify.uploadCover(playlist.id, await renderCover(concert, matches));
  } catch {
    // A missing cover is not worth failing the whole playlist for.
  }

  return playlist.url;
}
