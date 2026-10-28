import type { Token } from './auth.ts';

const API_URL = 'https://api.spotify.com/v1';

export type Track = {
  uri: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    id: string;
    name: string;
    /** Widest first. */
    images: Array<{ url: string; width: number; height: number }>;
  };
};

/**
 * Minimal Spotify Web API client for the handful of endpoints we need. Uses the endpoints from
 * the February 2026 Web API update (`/me/playlists`, `/playlists/{id}/items`).
 */
export class SpotifyClient {
  #token: Token;
  readonly #refresh: (token: Token) => Promise<Token>;
  /** Shared so concurrent requests wait for a single refresh. */
  #refreshing?: Promise<void>;

  /** @param refresh Exchanges the token for a fresh one; access tokens only last an hour. */
  constructor(token: Token, refresh: (token: Token) => Promise<Token>) {
    this.#token = token;
    this.#refresh = refresh;
  }

  async searchTrack(track: string, artist: string): Promise<Track | undefined> {
    const params = new URLSearchParams({
      q: `track:${track} artist:${artist}`,
      type: 'track',
      limit: '1',
    });
    const data = await this.request<{ tracks: { items: Array<Track> } }>(
      `/search?${params.toString()}`,
    );

    return data.tracks.items[0];
  }

  /** Free-text track search, for picking an alternative by hand. */
  async searchTracks(query: string, limit = 10): Promise<Array<Track>> {
    const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) });
    const data = await this.request<{ tracks: { items: Array<Track> } }>(
      `/search?${params.toString()}`,
    );

    return data.tracks.items;
  }

  async createPlaylist(name: string, description: string): Promise<{ id: string; url: string }> {
    const data = await this.request<{ id: string; external_urls: { spotify: string } }>(
      '/me/playlists',
      { method: 'POST', body: JSON.stringify({ name, description, public: true }) },
    );

    return { id: data.id, url: data.external_urls.spotify };
  }

  async addItems(playlistId: string, uris: Array<string>): Promise<void> {
    // The API accepts at most 100 items per request.
    for (let index = 0; index < uris.length; index += 100) {
      await this.request(`/playlists/${playlistId}/items`, {
        method: 'POST',
        body: JSON.stringify({ uris: uris.slice(index, index + 100) }),
      });
    }
  }

  /** @param jpeg Base64 encoded JPEG, max 256 KB. */
  async uploadCover(playlistId: string, jpeg: string): Promise<void> {
    await this.request(`/playlists/${playlistId}/images`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: jpeg,
    });
  }

  private async refreshToken(): Promise<void> {
    this.#refreshing ??= this.#refresh(this.#token)
      .then((token) => {
        this.#token = token;
      })
      .finally(() => {
        this.#refreshing = undefined;
      });
    return this.#refreshing;
  }

  private async request<T = unknown>(
    path: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
    isRetry = false,
  ): Promise<T> {
    if (this.#token.expiresAt - 60_000 < Date.now()) await this.refreshToken();

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.#token.accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    // The token can still be rejected early (e.g. revoked, or the clock is off): refresh once.
    if (response.status === 401 && !isRetry) {
      await this.refreshToken();
      return this.request(path, init, true);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? 1);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.request(path, init);
    }

    if (!response.ok) {
      throw new Error(`Spotify ${init.method ?? 'GET'} ${path} failed: ${response.status}`);
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
