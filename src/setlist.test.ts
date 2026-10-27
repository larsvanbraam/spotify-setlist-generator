import { describe, expect, it } from 'vite-plus/test';

import { getPlaylistName, getSongs, toIsoDate } from './setlist.ts';
import type { Concert } from './setlist.ts';

const concert = {
  eventDate: '21-06-2024',
  artist: { name: 'Radiohead' },
  venue: { name: 'Ziggo Dome', city: { name: 'Amsterdam', country: { code: 'NL' } } },
  sets: {
    set: [{ song: [{ name: 'Airbag' }, { name: '' }] }, { encore: 1, song: [{ name: 'Creep' }] }],
  },
} as Concert;

describe('setlist', () => {
  it('converts setlist.fm dates to ISO dates', () => {
    expect(toIsoDate('21-06-2024')).toBe('2024-06-21');
  });

  it('flattens sets and encores, skipping unnamed songs', () => {
    expect(getSongs(concert).map((song) => song.name)).toEqual(['Airbag', 'Creep']);
  });

  it('builds a sortable playlist name', () => {
    expect(getPlaylistName(concert)).toBe('Radiohead - Ziggo Dome - 2024-06-21');
  });
});
