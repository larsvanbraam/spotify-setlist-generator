/**
 * Renders the real UI components with sample data and writes them as terminal "screenshots"
 * (SVG) to `.github/assets`, for the README. Run with `npm run screenshots`.
 */
import { writeFile } from 'node:fs/promises';

import { Box, Text, renderToString } from 'ink';
import type { ReactNode } from 'react';

import type { Match } from '../src/playlist.ts';
import { formatLocation, getSongs, toIsoDate } from '../src/setlist.ts';
import type { Concert } from '../src/setlist.ts';
import { Header } from '../src/ui/components/Header.tsx';
import { KeyHints } from '../src/ui/components/KeyHints.tsx';
import { ProgressBar } from '../src/ui/components/ProgressBar.tsx';
import { ConcertPicker } from '../src/ui/screens/ConcertPicker.tsx';
import { MatchList } from '../src/ui/screens/MatchList.tsx';
import { theme } from '../src/ui/theme.ts';

const COLUMNS = 112;
const ROWS = 30;
const OUTPUT_DIR = new URL('../.github/assets/', import.meta.url);

// `useWindowSize` reads the size from stdout, which is not a TTY here.
Object.assign(process.stdout, { columns: COLUMNS, rows: ROWS });

const artist = { mbid: '', name: 'Radiohead', sortName: 'Radiohead', url: '' };

function concert(date: string, venue: string, city: string, country: string, songs: Array<string>) {
  return {
    id: date,
    versionId: '',
    eventDate: date,
    lastUpdated: '',
    artist,
    venue: {
      id: venue,
      name: venue,
      city: {
        id: city,
        name: city,
        coords: { lat: 0, long: 0 },
        country: { code: country, name: '' },
      },
      url: '',
    },
    tour: { name: 'Hail to the Thief Tour 2025' },
    sets: { set: [{ song: songs.map((name) => ({ name })) }] },
    url: '',
  } satisfies Concert;
}

const setlist = [
  '2 + 2 = 5',
  'Sit Down. Stand Up.',
  'Airbag',
  'Lucky',
  'Bloom',
  'Weird Fishes/Arpeggi',
  'The Gloaming',
  'Myxomatosis',
  'Everything In Its Right Place',
  'Idioteque',
  'There There',
  'Paranoid Android',
  'Karma Police',
];

const concerts = [
  concert('14-11-2025', 'Ziggo Dome', 'Amsterdam', 'NL', setlist),
  concert('13-11-2025', 'Ziggo Dome', 'Amsterdam', 'NL', setlist.slice(2)),
  concert('09-11-2025', 'Uber Arena', 'Berlin', 'DE', setlist.slice(1)),
  concert('08-11-2025', 'Uber Arena', 'Berlin', 'DE', setlist.slice(0, 11)),
  concert('04-11-2025', 'The O2 Arena', 'London', 'GB', setlist.slice(3)),
  concert('03-11-2025', 'The O2 Arena', 'London', 'GB', setlist),
  concert('30-10-2025', 'Unipol Arena', 'Bologna', 'IT', setlist.slice(0, 12)),
  concert('29-10-2025', 'Unipol Arena', 'Bologna', 'IT', setlist.slice(2)),
  concert('25-10-2025', 'Movistar Arena', 'Madrid', 'ES', setlist.slice(1)),
  concert('24-10-2025', 'Movistar Arena', 'Madrid', 'ES', setlist),
];

const shown = concerts[0]!;
const matches: Array<Match> = getSongs(shown).map((song) =>
  song.name === 'The Gloaming'
    ? { song }
    : {
        song,
        track: {
          uri: '',
          name: song.name,
          artists: [{ name: 'Radiohead' }],
          album: { id: '', name: '', images: [] },
        },
      },
);

const screens: Record<string, ReactNode> = {
  'screenshot-concerts': (
    <Screen>
      <ConcertPicker concerts={concerts} onSubmit={() => {}} onCancel={() => {}} />
    </Screen>
  ),
  'screenshot-review': (
    <Screen>
      <Text>
        <Text bold>{shown.artist.name}</Text>
        <Text color={theme.muted}> @ </Text>
        {formatLocation(shown)}
        <Text color={theme.muted}> · {toIsoDate(shown.eventDate)}</Text>
      </Text>
      <Box marginY={1}>
        <ProgressBar value={matches.length} total={matches.length} />
      </Box>
      <MatchList songs={getSongs(shown)} matches={matches} limit={16} />
      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text color={theme.accent} bold>
            12
          </Text>{' '}
          of 13 songs found on Spotify
          <Text color={theme.error}> · 1 missing</Text>
        </Text>
        <KeyHints
          hints={[
            ['enter', 'create playlist'],
            ['esc', 'pick another concert'],
            ['q', 'quit'],
          ]}
        />
      </Box>
    </Screen>
  ),
};

function Screen({ children }: { children: ReactNode }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Header subtitle="Turn any setlist.fm concert into a Spotify playlist" />
      {children}
    </Box>
  );
}

// --- ANSI → SVG ----------------------------------------------------------------------------

const BACKGROUND = '#121212';
const FOREGROUND = '#e6e6e6';
const PALETTE: Record<number, string> = { 37: '#ffffff', 90: '#8b8b8b' };
const CELL = { width: 8.4, height: 19 };
const PADDING = { x: 20, top: 48, bottom: 20 };

// eslint-disable-next-line no-control-regex
const SGR = /\x1b\[([\d;]*)m/;

type Style = { color?: string; bold: boolean; inverse: boolean };
type Run = { column: number; text: string; style: Style };

/** Splits each line of ANSI output into runs of equally styled text. */
function parseAnsi(output: string): Array<Array<Run>> {
  return output.split('\n').map((line) => {
    const runs: Array<Run> = [];
    let style: Style = { bold: false, inverse: false };
    let column = 0;

    for (const part of line.split(new RegExp(`(${SGR.source})`))) {
      const codes = part.match(SGR)?.[1];
      if (codes === undefined) {
        if (part) runs.push({ column, text: part, style });
        column += Array.from(part).length;
        continue;
      }

      style = { ...style };
      const values = codes.split(';').map(Number);
      for (let index = 0; index < values.length; index++) {
        const code = values[index]!;
        if (code === 0) style = { bold: false, inverse: false };
        else if (code === 1) style.bold = true;
        else if (code === 22) style.bold = false;
        else if (code === 7) style.inverse = true;
        else if (code === 27) style.inverse = false;
        else if (code === 39) style.color = undefined;
        else if (code === 38 && values[index + 1] === 2) {
          const [r, g, b] = values.slice(index + 2, index + 5);
          style.color = `#${[r, g, b].map((value) => value!.toString(16).padStart(2, '0')).join('')}`;
          index += 4;
        } else if (PALETTE[code]) style.color = PALETTE[code];
      }
    }

    return runs;
  });
}

/** Box drawing characters are drawn as strokes, so borders connect regardless of the font. */
const BOX_PATHS: Record<string, (x: number, y: number, cx: number, cy: number) => string> = {
  '─': (x, _y, _cx, cy) => `M${x} ${cy}h${CELL.width}`,
  '│': (_x, y, cx) => `M${cx} ${y}v${CELL.height}`,
  '╭': (x, y, cx, cy) => `M${x + CELL.width} ${cy}Q${cx} ${cy} ${cx} ${y + CELL.height}`,
  '╮': (x, y, cx, cy) => `M${x} ${cy}Q${cx} ${cy} ${cx} ${y + CELL.height}`,
  '╰': (x, y, cx, cy) => `M${cx} ${y}Q${cx} ${cy} ${x + CELL.width} ${cy}`,
  '╯': (x, y, cx, cy) => `M${cx} ${y}Q${cx} ${cy} ${x} ${cy}`,
};

function toSvg(output: string): string {
  const lines = parseAnsi(output.replace(/\n+$/, ''));
  const usedColumns = Math.max(
    ...lines.flat().map((run) => run.column + Array.from(run.text.trimEnd()).length),
  );
  const width = Math.ceil(usedColumns * CELL.width + PADDING.x * 2);
  const height = Math.ceil(lines.length * CELL.height + PADDING.top + PADDING.bottom);
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const round = (value: number) => Math.round(value * 10) / 10;

  const body = lines.flatMap((runs, row) => {
    const y = PADDING.top + row * CELL.height;
    return runs.flatMap(({ column, text, style }) => {
      const chars = Array.from(text);
      const x = (offset: number) => round(PADDING.x + (column + offset) * CELL.width);
      const color = style.color ?? FOREGROUND;
      const elements: Array<string> = [];

      if (style.inverse) {
        elements.push(
          `<rect x="${x(0)}" y="${y}" width="${chars.length * CELL.width}" height="${CELL.height}" fill="${color}"/>`,
        );
      }

      const paths = chars.flatMap((char, index) => {
        const draw = BOX_PATHS[char];
        return draw
          ? [draw(x(index), y, round(x(index) + CELL.width / 2), y + CELL.height / 2)]
          : [];
      });
      if (paths.length > 0) {
        elements.push(
          `<path d="${paths.join('')}" stroke="${color}" stroke-width="1.5" fill="none"/>`,
        );
      }

      const glyphs = chars.map((char) => (BOX_PATHS[char] ? ' ' : char)).join('');
      if (glyphs.trim()) {
        elements.push(
          `<text x="${chars.map((_, index) => x(index)).join(' ')}" y="${y + 14}" fill="${style.inverse ? BACKGROUND : color}"${style.bold ? ' font-weight="bold"' : ''}>${escape(glyphs)}</text>`,
        );
      }
      return elements;
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="10" fill="${BACKGROUND}"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="9.5" fill="none" stroke="#2a2a2a"/>
  <circle cx="22" cy="20" r="6" fill="#ff5f57"/>
  <circle cx="42" cy="20" r="6" fill="#febc2e"/>
  <circle cx="62" cy="20" r="6" fill="#28c840"/>
  <text x="${width / 2}" y="24" fill="#8b8b8b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" text-anchor="middle">setlist</text>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" font-size="14" xml:space="preserve">
    ${body.join('\n    ')}
  </g>
</svg>
`;
}

for (const [name, node] of Object.entries(screens)) {
  const svg = toSvg(renderToString(node, { columns: COLUMNS }));
  await writeFile(new URL(`${name}.svg`, OUTPUT_DIR), svg);
  console.log(`✓ .github/assets/${name}.svg`);
}
