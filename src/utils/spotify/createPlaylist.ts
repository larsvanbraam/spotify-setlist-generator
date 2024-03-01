import { spotifyApi } from '../spotifyApi';

export async function createPlaylist(playlistName: string): Promise<string> {
  const data = await spotifyApi.createPlaylist(playlistName, {
    collaborative: false,
    public: true,
  });
  return data.body.id;
}
