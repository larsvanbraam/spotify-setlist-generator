import { Concert } from '../../types/Concert';
import { spotifyApi } from '../spotifyApi';

export async function getTrackUrisForConcert(concert: Concert): Promise<Array<string>> {
  const songs = await Promise.all(
    concert.sets.set
      .map((set) => set.song.map((song) => song))
      .reduce((a, b) => a.concat(b), [])
      .map(async (song) => {
        let data;

        if (song.cover) {
          data = await spotifyApi.searchTracks(`track:${song.name} artist:${song.cover.name}`);
        } else {
          data = await spotifyApi.searchTracks(`track:${song.name} artist:${concert.artist.name}`);
        }

        if ((data.body.tracks?.items.length ?? 0) > 0) {
          return data.body.tracks?.items[0].uri;
        } else {
          console.log(
            `\n Track ${song.name} by ${song.cover ? '' : concert.artist.name} not found on Spotify.`,
          );
          return null;
        }
      }),
  );

  return songs.filter((song): song is string => Boolean(song));
}
