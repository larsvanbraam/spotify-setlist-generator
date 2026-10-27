# spotify-setlist-generator

Turn any [setlist.fm](https://www.setlist.fm) concert into a Spotify playlist, from a terminal UI.

```
╭────────────────────────╮
│  ♫  setlist → spotify  │
╰────────────────────────╯
 Radiohead @ AFAS Live, Amsterdam, NL · 2024-06-12

 ████████████████████████████████████  13/13

 ✓ 15 Step  → 15 Step · Radiohead
 ✗ Faust Arp not found on Spotify
 ✓ Creep  → Creep · Radiohead

 12 of 13 songs found on Spotify · 1 missing
```

Search an artist, browse their recent setlists with a live preview, watch each song get matched on
Spotify, and create the playlist (with a generated cover) in one keypress.

## Requirements

- Node.js 24+
- A Spotify app: create one on the [Spotify developer dashboard](https://developer.spotify.com/dashboard)
  and add `http://127.0.0.1:8888/callback` as a redirect URI. No client secret is needed, login uses
  PKCE.
- A setlist.fm API key: request one at https://www.setlist.fm/settings/apps

## Getting started

```bash
cp .env.example .env   # fill in your Spotify client id and setlist.fm API key
npm install
npm run dev
```

The first run opens your browser to log in to Spotify. The token is cached (and refreshed
automatically) in `~/.config/spotify-setlist-generator/token.json`.

To use it as a global `setlist` command:

```bash
npm run build && npm link
```

## Development

The project uses [Vite+](https://viteplus.dev) (`vp`) for formatting, linting, type checking,
testing and bundling, [Ink](https://github.com/vadimdemedes/ink) for the UI, and TypeScript 7.

| Script          | What it does                         |
| --------------- | ------------------------------------ |
| `npm run dev`   | Run the CLI from source (`vpx`)      |
| `npm run check` | Format check, lint and type check    |
| `npm run fmt`   | Format all files                     |
| `npm test`      | Run the tests                        |
| `npm run build` | Bundle to `dist/cli.mjs` (`vp pack`) |
| `npm start`     | Run the bundled CLI                  |
