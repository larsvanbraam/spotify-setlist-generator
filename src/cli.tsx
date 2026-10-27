#!/usr/bin/env node
import { render } from 'ink';

import { loadEnv } from './env.ts';
import type { Env } from './env.ts';
import { App } from './ui/App.tsx';

let env: Env;
try {
  env = loadEnv();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const createdPlaylists: Array<string> = [];

const { waitUntilExit } = render(
  <App env={env} onPlaylistCreated={(url) => createdPlaylists.push(url)} />,
);

await waitUntilExit();

for (const url of createdPlaylists) console.log(`♫ ${url}`);
process.exit(0);
