import { formatLocation, getPlaylistName, getSongs, toIsoDate } from './setlist.ts';
import type { Concert, Song } from './setlist.ts';
import type { SpotifyClient, Track } from './spotify/client.ts';

export type Match = { song: Song; track?: Track };

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
    await spotify.uploadCover(playlist.id, await createCover(concert));
  } catch {
    // A missing cover is not worth failing the whole playlist for.
  }

  return playlist.url;
}

/** Generates a simple poster-style cover for the playlist. */
async function createCover(concert: Concert): Promise<string> {
  const label = [concert.artist.name, concert.venue.name, toIsoDate(concert.eventDate)].join('\n');
  const response = await fetch(
    `https://placehold.co/640x640/121212/1DB954/jpeg?font=montserrat&text=${encodeURIComponent(label)}`,
  );
  if (!response.ok) throw new Error(`Cover request failed: ${response.status}`);

  return Buffer.from(await response.arrayBuffer()).toString('base64');
}
