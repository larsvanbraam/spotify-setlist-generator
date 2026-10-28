import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Token } from './auth.ts';
import { SpotifyClient } from './client.ts';

const token = (accessToken: string, expiresIn = 3_600_000): Token => ({
  accessToken,
  refreshToken: 'refresh',
  expiresAt: Date.now() + expiresIn,
});

/** Answers 401 unless the request carries one of the accepted access tokens. */
function mockSpotify(acceptedTokens: Array<string>) {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const auth = (init.headers as Record<string, string>).Authorization;
    return acceptedTokens.some((accepted) => auth === `Bearer ${accepted}`)
      ? Response.json({ tracks: { items: [{ name: 'Track' }] } })
      : new Response(null, { status: 401 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SpotifyClient', () => {
  it('refreshes an expired token once for concurrent requests', async () => {
    mockSpotify(['fresh']);
    const refresh = vi.fn(async () => token('fresh'));
    const client = new SpotifyClient(token('stale', -1), refresh);

    await Promise.all([client.searchTrack('a', 'b'), client.searchTrack('c', 'd')]);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes and retries when Spotify rejects the token', async () => {
    const fetchMock = mockSpotify(['fresh']);
    const refresh = vi.fn(async () => token('fresh'));
    const client = new SpotifyClient(token('revoked'), refresh);

    await expect(client.searchTrack('a', 'b')).resolves.toEqual({ name: 'Track' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up when the refreshed token is rejected too', async () => {
    mockSpotify([]);
    const client = new SpotifyClient(token('revoked'), async () => token('also-revoked'));

    await expect(client.searchTrack('a', 'b')).rejects.toThrow('failed: 401');
  });
});
