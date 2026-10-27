export type Artist = {
  mbid: string;
  name: string;
  sortName: string;
  disambiguation?: string;
  url: string;
};

export type Song = {
  name: string;
  cover?: Artist;
  with?: Artist;
  info?: string;
  tape?: boolean;
};

export type SetPart = {
  name?: string;
  encore?: number;
  song: Array<Song>;
};

export type Concert = {
  id: string;
  versionId: string;
  /** Formatted as dd-MM-yyyy by setlist.fm. */
  eventDate: string;
  lastUpdated: string;
  artist: Artist;
  venue: {
    id: string;
    name: string;
    city: {
      id: string;
      name: string;
      state?: string;
      stateCode?: string;
      coords: { lat: number; long: number };
      country: { code: string; name: string };
    };
    url: string;
  };
  tour?: { name: string };
  sets: { set: Array<SetPart> };
  url: string;
};

const API_URL = 'https://api.setlist.fm/rest/1.0';
const PAGES = 3; // setlist.fm returns 20 setlists per page

/**
 * Fetches the most recent setlists for an artist, skipping future shows and empty setlists.
 */
export async function searchConcerts(artistName: string, apiKey: string): Promise<Array<Concert>> {
  const concerts: Array<Concert> = [];

  for (let page = 1; page <= PAGES; page++) {
    const url = new URL(`${API_URL}/search/setlists`);
    url.searchParams.set('artistName', artistName);
    url.searchParams.set('p', String(page));

    const response = await fetch(url, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    });

    // setlist.fm answers 404 when a search has no (more) results.
    if (response.status === 404) break;
    if (!response.ok) {
      throw new Error(`setlist.fm request failed: ${response.status} ${response.statusText}`);
    }

    const { setlist = [], total } = (await response.json()) as {
      setlist?: Array<Concert>;
      total: number;
    };
    concerts.push(...setlist);

    if (setlist.length === 0 || concerts.length >= total) break;

    // Stay well within setlist.fm's rate limit.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const today = new Date().toISOString().slice(0, 10);
  return concerts.filter(
    (concert) => getSongs(concert).length > 0 && toIsoDate(concert.eventDate) <= today,
  );
}

/** Flattens all sets (including encores) into a single list of songs. */
export function getSongs(concert: Concert): Array<Song> {
  return (concert.sets.set ?? []).flatMap((set) => set.song).filter((song) => song.name.trim());
}

/** Converts setlist.fm's dd-MM-yyyy into a sortable yyyy-MM-dd. */
export function toIsoDate(eventDate: string): string {
  const [day, month, year] = eventDate.split('-');
  return `${year}-${month}-${day}`;
}

export function formatLocation(concert: Concert): string {
  const { city } = concert.venue;
  return `${concert.venue.name}, ${city.name}, ${city.country.code}`;
}

export function getPlaylistName(concert: Concert): string {
  return `${concert.artist.name} - ${concert.venue.name} - ${toIsoDate(concert.eventDate)}`;
}
