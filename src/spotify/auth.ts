import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const ACCOUNTS_URL = 'https://accounts.spotify.com';
const SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'ugc-image-upload'];
const TOKEN_FILE = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
  'spotify-setlist-generator',
  'token.json',
);

export type Token = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

type AuthOptions = {
  clientId: string;
  redirectUri: URL;
  /** Called with the authorize URL when the user needs to log in through the browser. */
  onLoginRequired?: (url: string) => void;
};

/**
 * Returns a valid Spotify token: from the cache, by refreshing it, or by running the
 * Authorization Code with PKCE flow in the browser (no client secret needed).
 */
export async function authenticate(options: AuthOptions): Promise<Token> {
  const cached = await readToken();

  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached;

  if (cached) {
    try {
      return await refreshToken(options.clientId, cached);
    } catch {
      // Refresh token was revoked or expired, fall through to a fresh login.
    }
  }

  return saveToken(await login(options));
}

/** Trades the refresh token for a new access token and caches it. */
export async function refreshToken(clientId: string, token: Token): Promise<Token> {
  return saveToken(
    await requestToken(clientId, {
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }),
    token.refreshToken,
  );
}

async function login({ clientId, redirectUri, onLoginRequired }: AuthOptions) {
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');

  const authorizeUrl = new URL(`${ACCOUNTS_URL}/authorize`);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri.href,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES.join(' '),
    state,
  }).toString();

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', redirectUri);
      if (url.pathname !== redirectUri.pathname) {
        res.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get('code');
      const error =
        url.searchParams.get('error') ??
        (url.searchParams.get('state') !== state ? 'state_mismatch' : null);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        error || !code
          ? `<h1>Spotify login failed</h1><p>${error}</p>`
          : '<h1>Logged in to Spotify</h1><p>You can close this window and return to the terminal.</p>',
      );

      server.close();
      if (error || !code) reject(new Error(`Spotify login failed: ${error ?? 'no code'}`));
      else resolve(code);
    });

    server.on('error', reject);
    server.listen(Number(redirectUri.port || 80), redirectUri.hostname, () => {
      onLoginRequired?.(authorizeUrl.href);
      openBrowser(authorizeUrl.href);
    });
  });

  return requestToken(clientId, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri.href,
    code_verifier: verifier,
  });
}

async function requestToken(clientId: string, params: Record<string, string>) {
  const response = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...params }),
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

async function readToken(): Promise<Token | undefined> {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, 'utf8')) as Token;
  } catch {
    return undefined;
  }
}

async function saveToken(
  data: Awaited<ReturnType<typeof requestToken>>,
  previousRefreshToken?: string,
): Promise<Token> {
  const token: Token = {
    accessToken: data.access_token,
    // Spotify may or may not rotate the refresh token on refresh.
    refreshToken: data.refresh_token ?? previousRefreshToken ?? '',
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await mkdir(dirname(TOKEN_FILE), { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), { mode: 0o600 });

  return token;
}

function openBrowser(url: string) {
  const [command, ...args] =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '""', url]
        : ['xdg-open', url];

  spawn(command!, args, { stdio: 'ignore', detached: true })
    .on('error', () => {}) // The URL is also shown in the UI as a fallback.
    .unref();
}
