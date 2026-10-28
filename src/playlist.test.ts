import { describe, expect, it, vi } from 'vite-plus/test';

import { createSetlistPlaylist } from './playlist.ts';
import { withDetails } from './setlist.ts';
import type { Concert } from './setlist.ts';
import type { SpotifyClient } from './spotify/client.ts';

const concert = {
  eventDate: '21-06-2024',
  artist: { name: 'Radiohead' },
  venue: {
    name: 'Ziggo Dome',
    city: { name: 'Amsterdam', country: { code: 'NL', name: 'Netherlands' } },
  },
  sets: { set: [] },
  url: 'https://www.setlist.fm/setlist/radiohead/2024/ziggo-dome.html',
} as unknown as Concert;

function fakeSpotify() {
  return {
    createPlaylist: vi.fn(async () => ({ id: 'id', url: 'https://open.spotify.com/playlist/id' })),
    addItems: vi.fn(async () => {}),
    uploadCover: vi.fn(async () => {}),
  };
}

describe('createSetlistPlaylist', () => {
  it('names the playlist after the concert by default', async () => {
    const spotify = fakeSpotify();
    await createSetlistPlaylist(spotify as unknown as SpotifyClient, concert, [], () => {});

    expect(spotify.createPlaylist).toHaveBeenCalledWith(
      'Radiohead - Ziggo Dome - 2024-06-21',
      `Setlist of Radiohead at Ziggo Dome, Amsterdam, NL. ${concert.url}`,
    );
  });

  it('names an edited concert after its own details and credits the original setlist', async () => {
    const spotify = fakeSpotify();
    const edited = withDetails(concert, {
      artistName: 'Radiohead',
      venueName: 'AFAS Live',
      cityName: 'Amsterdam',
      countryName: 'Netherlands',
      date: '2024-06-23',
    });
    await createSetlistPlaylist(spotify as unknown as SpotifyClient, edited, [], () => {}, {
      basedOn: concert,
    });

    expect(spotify.createPlaylist).toHaveBeenCalledWith(
      'Radiohead - AFAS Live - 2024-06-23',
      `Based on the setlist of Radiohead at Ziggo Dome, Amsterdam, NL on 2024-06-21. ${concert.url}`,
    );
  });

  it('marks a pre-show playlist as a prediction for the upcoming show', async () => {
    const spotify = fakeSpotify();
    const upcoming = withDetails(concert, {
      artistName: 'Radiohead',
      venueName: 'AFAS Live',
      cityName: 'Amsterdam',
      countryName: 'Netherlands',
      date: '2024-06-23',
    });
    await createSetlistPlaylist(spotify as unknown as SpotifyClient, upcoming, [], () => {}, {
      basedOn: concert,
      preShow: true,
    });

    expect(spotify.createPlaylist).toHaveBeenCalledWith(
      'Pre-show: Radiohead - AFAS Live - 2024-06-23',
      `Predicted setlist for Radiohead at AFAS Live, Amsterdam, NL on 2024-06-23, based on the setlist of Radiohead at Ziggo Dome, Amsterdam, NL on 2024-06-21. ${concert.url}`,
    );
  });
});
