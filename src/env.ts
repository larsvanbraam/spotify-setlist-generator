import { existsSync } from 'node:fs';

export type Env = {
  spotifyClientId: string;
  spotifyRedirectUri: URL;
  setlistApiKey: string;
};

/**
 * Loads `.env` (if present) with Node's built-in loader and validates the values we need.
 */
export function loadEnv(): Env {
  if (existsSync('.env')) process.loadEnvFile('.env');

  const missing = ['SPOTIFY_CLIENT_ID', 'SETLIST_API_KEY'].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}. See README.md.`);
  }

  return {
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID!,
    spotifyRedirectUri: new URL(
      process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:8888/callback',
    ),
    setlistApiKey: process.env.SETLIST_API_KEY!,
  };
}
