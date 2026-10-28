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

export type ConcertQuery = {
  artistName: string;
  /** Only return setlists from this year. */
  year?: number;
  /** Only return setlists from a city with this name. */
  cityName?: string;
};

export type ConcertBatch = {
  concerts: Array<Concert>;
  /** The setlist.fm page to continue from, undefined when there are no more results. */
  nextPage?: number;
};

/**
 * Fetches a batch of the most recent setlists for an artist, skipping future shows and empty
 * setlists. Pass the returned `nextPage` back in to load older setlists.
 */
export async function searchConcerts(
  { artistName, year, cityName }: ConcertQuery,
  apiKey: string,
  startPage = 1,
): Promise<ConcertBatch> {
  const concerts: Array<Concert> = [];
  let nextPage: number | undefined;

  for (let page = startPage; page < startPage + PAGES; page++) {
    const url = new URL(`${API_URL}/search/setlists`);
    url.searchParams.set('artistName', artistName);
    if (year) url.searchParams.set('year', String(year));
    if (cityName) url.searchParams.set('cityName', cityName);
    url.searchParams.set('p', String(page));

    const response = await fetchWithRetry(url, apiKey);

    // setlist.fm answers 404 when a search has no (more) results.
    if (response.status === 404) {
      nextPage = undefined;
      break;
    }
    if (response.status === 429) {
      // Already have results: show what we got and let the next batch pick up from here.
      if (concerts.length > 0) {
        nextPage = page;
        break;
      }
      throw new Error(
        'setlist.fm rate limit reached. Wait a minute and try again (the daily limit resets at midnight UTC).',
      );
    }
    if (!response.ok) {
      throw new Error(`setlist.fm request failed: ${response.status} ${response.statusText}`);
    }

    const {
      setlist = [],
      total,
      itemsPerPage,
    } = (await response.json()) as {
      setlist?: Array<Concert>;
      total: number;
      itemsPerPage: number;
    };
    concerts.push(...setlist);

    const hasMore = setlist.length > 0 && page * itemsPerPage < total;
    nextPage = hasMore ? page + 1 : undefined;
    if (!hasMore) break;

    // setlist.fm allows ~2 requests/second; leave plenty of headroom.
    if (page < startPage + PAGES - 1) await sleep(1000);
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    concerts: concerts.filter(
      (concert) => getSongs(concert).length > 0 && toIsoDate(concert.eventDate) <= today,
    ),
    nextPage,
  };
}

const MAX_RETRIES = 3;

/** GETs from setlist.fm, backing off and retrying when rate limited (429). */
async function fetchWithRetry(url: URL, apiKey: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    });
    if (response.status !== 429 || attempt >= MAX_RETRIES) return response;

    const retryAfter = Number(response.headers.get('retry-after'));
    const delay = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    // A long Retry-After means the daily quota is gone; don't hang the UI waiting for it.
    if (delay > 10_000) return response;
    await sleep(delay);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Flattens all sets (including encores) into a single list of songs. */
export function getSongs(concert: Concert): Array<Song> {
  return (concert.sets.set ?? []).flatMap((set) => set.song).filter((song) => song.name.trim());
}

/**
 * Splits a medley into its songs. setlist.fm writes medleys as "Song A / Song B / Song C"; only a
 * slash with spaces around it counts, so titles like "AC/DC" or "Either/Or" stay intact.
 * Returns a single song for anything that isn't a medley.
 */
export function splitMedley(song: Song): Array<Song> {
  const names = song.name
    .split(' / ')
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 1 ? names.map((name) => ({ ...song, name })) : [song];
}

/** Converts setlist.fm's dd-MM-yyyy into a sortable yyyy-MM-dd. */
export function toIsoDate(eventDate: string): string {
  const [day, month, year] = eventDate.split('-');
  return `${year}-${month}-${day}`;
}

/** Describes the optional filters of a query, e.g. " in Amsterdam in 2017", or "" without any. */
export function formatFilters({ cityName, year }: ConcertQuery): string {
  return [cityName, year].map((filter) => (filter ? ` in ${filter}` : '')).join('');
}

/** The parts of a concert that end up in the playlist name, description and cover. */
export type ConcertDetails = {
  artistName: string;
  venueName: string;
  cityName: string;
  countryName: string;
  /** yyyy-MM-dd */
  date: string;
};

export function getDetails(concert: Concert): ConcertDetails {
  return {
    artistName: concert.artist.name,
    venueName: concert.venue.name,
    cityName: concert.venue.city.name,
    countryName: concert.venue.city.country.name,
    date: toIsoDate(concert.eventDate),
  };
}

/**
 * Returns a copy of the concert with its details replaced, e.g. for a show with the same setlist
 * that isn't on setlist.fm. The songs stay the same.
 */
export function withDetails(concert: Concert, details: ConcertDetails): Concert {
  const { country } = concert.venue.city;
  const [year, month, day] = details.date.split('-');

  return {
    ...concert,
    artist: { ...concert.artist, name: details.artistName },
    eventDate: `${day}-${month}-${year}`,
    venue: {
      ...concert.venue,
      name: details.venueName,
      city: {
        ...concert.venue.city,
        name: details.cityName,
        country:
          details.countryName === country.name
            ? country
            : // We don't know the code of a typed country, so show its name where the code goes.
              { code: details.countryName, name: details.countryName },
      },
    },
  };
}

export function formatLocation(concert: Concert): string {
  const { city } = concert.venue;
  return `${concert.venue.name}, ${city.name}, ${city.country.code}`;
}

export function getPlaylistName(concert: Concert): string {
  return `${concert.artist.name} - ${concert.venue.name} - ${toIsoDate(concert.eventDate)}`;
}
