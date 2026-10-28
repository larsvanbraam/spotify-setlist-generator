import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import satori from 'satori';
import type { Font } from 'satori';
import sharp from 'sharp';

import type { Match, PlaylistOptions } from '../playlist.ts';
import { toIsoDate } from '../setlist.ts';
import type { Concert } from '../setlist.ts';
import { accentFromName, createArtwork, getTopAlbumImages } from './artwork.ts';
import type { Artwork } from './artwork.ts';

const SIZE = 640;
/** Spotify rejects cover images over 256 KB (of base64). */
const MAX_BASE64_BYTES = 256 * 1024;

/**
 * Renders a concert-poster style cover: blurred album art from the setlist behind the artist
 * name, venue and date. Pre-show covers flip that around, see `PreShowPoster`. Returns a base64
 * encoded JPEG ready for the Spotify API.
 */
export async function renderCover(
  concert: Concert,
  matches: Array<Match>,
  { basedOn, preShow = false }: PlaylistOptions = {},
): Promise<string> {
  const tracks = matches.flatMap((match) => (match.track ? [match.track] : []));
  const imageUrls = getTopAlbumImages(tracks);

  let artwork: Artwork | undefined;
  try {
    if (imageUrls.length > 0) {
      artwork = await createArtwork(imageUrls, SIZE, { monochrome: preShow });
    }
  } catch {
    // Artwork is a nice-to-have, fall back to the plain gradient.
  }

  const svg = await satori(
    preShow ? (
      <PreShowPoster concert={concert} basedOn={basedOn ?? concert} artwork={artwork} />
    ) : (
      <Poster concert={concert} songCount={tracks.length} artwork={artwork} />
    ),
    { width: SIZE, height: SIZE, fonts: await loadFonts() },
  );

  for (const quality of [90, 80, 70, 60]) {
    const jpeg = (
      await sharp(Buffer.from(svg)).jpeg({ quality, mozjpeg: true }).toBuffer()
    ).toString('base64');
    if (jpeg.length <= MAX_BASE64_BYTES) return jpeg;
  }

  throw new Error('Cover image is too large for Spotify');
}

type PosterProps = { concert: Concert; songCount: number; artwork?: Artwork };

function Poster({ concert, songCount, artwork }: PosterProps) {
  const accent = artwork?.accent ?? accentFromName(concert.artist.name);
  const { venue } = concert;

  return (
    <div
      style={{
        display: 'flex',
        width: SIZE,
        height: SIZE,
        position: 'relative',
        backgroundColor: '#0b0b0f',
        backgroundImage: artwork
          ? undefined
          : `radial-gradient(circle at 20% 15%, ${accent}66 0%, #0b0b0f 70%)`,
        fontFamily: 'Space Grotesk',
        color: '#fff',
      }}
    >
      {artwork && (
        <img src={artwork.background} width={SIZE} height={SIZE} style={{ position: 'absolute' }} />
      )}
      {/* Darken the bottom so the type stays readable on any artwork. */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          width: SIZE,
          height: SIZE,
          backgroundImage:
            'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          padding: 48,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              padding: '8px 18px',
              borderRadius: 999,
              backgroundColor: accent,
              color: '#0b0b0f',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            LIVE
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: 2,
              opacity: 0.85,
            }}
          >
            {formatDate(concert.eventDate)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {concert.tour?.name && (
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: 3,
                color: accent,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              {concert.tour.name}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: getTitleSize(concert.artist.name),
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: -2,
            }}
          >
            {concert.artist.name}
          </div>
          <div
            style={{
              display: 'flex',
              width: 72,
              height: 6,
              backgroundColor: accent,
              margin: '28px 0 20px',
            }}
          />
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>{venue.name}</div>
          <div
            style={{ display: 'flex', fontSize: 26, fontWeight: 500, opacity: 0.75, marginTop: 4 }}
          >
            {[venue.city.name, venue.city.country.name].join(', ')}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 32,
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: 2,
              opacity: 0.6,
            }}
          >
            <span>
              {songCount} {songCount === 1 ? 'SONG' : 'SONGS'}
            </span>
            <span>VIA SETLIST.FM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type PreShowPosterProps = { concert: Concert; basedOn: Concert; artwork?: Artwork };

/**
 * The inverse of `Poster`: dark type on a solid accent colour with a huge PRE / SHOW, so a
 * predicted setlist stands out from the dark live covers even as a tiny thumbnail.
 */
function PreShowPoster({ concert, basedOn, artwork }: PreShowPosterProps) {
  const accent = artwork?.accent ?? accentFromName(concert.artist.name);
  const ink = '#0b0b0f';
  const { venue } = concert;

  return (
    <div
      style={{
        display: 'flex',
        width: SIZE,
        height: SIZE,
        position: 'relative',
        backgroundColor: accent,
        fontFamily: 'Space Grotesk',
        color: ink,
      }}
    >
      {/* Just a hint of the album art, as texture. */}
      {artwork && (
        <img
          src={artwork.background}
          width={SIZE}
          height={SIZE}
          style={{ position: 'absolute', opacity: 0.22 }}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          padding: 48,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          <span>PREDICTED SETLIST</span>
          <span>{formatDate(concert.eventDate)}</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 168,
            fontWeight: 700,
            lineHeight: 0.82,
            letterSpacing: -6,
          }}
        >
          <span>PRE</span>
          <span>SHOW</span>
        </div>

        {/* A fixed width, so long names are cut off instead of widening the whole layout. */}
        <div style={{ display: 'flex', flexDirection: 'column', width: SIZE - 96 }}>
          <div
            style={{
              display: 'flex',
              fontSize: Math.min(56, getTitleSize(concert.artist.name)),
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -1,
            }}
          >
            {concert.artist.name}
          </div>
          <span style={{ ...ellipsis, fontSize: 26, fontWeight: 500, marginTop: 8 }}>
            {[venue.name, venue.city.name].join(', ')}
          </span>
          <div
            style={{
              display: 'flex',
              height: 3,
              backgroundColor: ink,
              margin: '24px 0 14px',
            }}
          />
          <span
            style={{
              ...ellipsis,
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: 2,
              opacity: 0.75,
            }}
          >
            {`Based on ${basedOn.venue.name} · ${formatDate(basedOn.eventDate)}`.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

const ellipsis = {
  display: 'block',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
} as const;

/** Long artist names get smaller type so they fit on two lines at most. */
function getTitleSize(name: string): number {
  if (name.length <= 8) return 112;
  if (name.length <= 14) return 88;
  if (name.length <= 22) return 70;
  return 56;
}

function formatDate(eventDate: string): string {
  return new Date(toIsoDate(eventDate))
    .toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
}

let fonts: Promise<Array<Font>> | undefined;

function loadFonts(): Promise<Array<Font>> {
  // The package only exports its CSS, so locate the font files through its exported LICENSE.
  const fontDir = join(
    dirname(createRequire(import.meta.url).resolve('@fontsource/space-grotesk/LICENSE')),
    'files',
  );
  const load = async (weight: 500 | 700, subset: 'latin' | 'latin-ext'): Promise<Font> => ({
    name: 'Space Grotesk',
    weight,
    style: 'normal',
    data: await readFile(join(fontDir, `space-grotesk-${subset}-${weight}-normal.woff`)),
  });

  fonts ??= Promise.all([
    load(500, 'latin'),
    load(700, 'latin'),
    load(500, 'latin-ext'),
    load(700, 'latin-ext'),
  ]);
  return fonts;
}
