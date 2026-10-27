import sharp from 'sharp';

import type { Track } from '../spotify/client.ts';

export type Artwork = {
  /** Blurred, darkened album art as a PNG data URI. */
  background: string;
  /** Dominant colour of the artwork, lightened to work as an accent. */
  accent: string;
};

/** Picks the albums that appear most in the setlist, most played first. */
export function getTopAlbumImages(tracks: Array<Track>, count = 4): Array<string> {
  const albums = new Map<string, { url: string; plays: number }>();

  for (const { album } of tracks) {
    // Spotify lists 640, 300 and 64px images; 300px is plenty once blurred.
    const image = album.images.find((image) => image.width <= 300) ?? album.images[0];
    if (!image) continue;

    const entry = albums.get(album.id) ?? { url: image.url, plays: 0 };
    entry.plays++;
    albums.set(album.id, entry);
  }

  return [...albums.values()]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, count)
    .map((album) => album.url);
}

/**
 * Builds a blurred collage of album covers: a 2×2 grid with four or more albums, otherwise the
 * most played album stretched over the whole cover.
 */
export async function createArtwork(imageUrls: Array<string>, size: number): Promise<Artwork> {
  const images = await Promise.all(
    imageUrls.map(async (url) => Buffer.from(await (await fetch(url)).arrayBuffer())),
  );

  let collage: Buffer;
  if (images.length >= 4) {
    const tile = size / 2;
    const tiles = await Promise.all(
      images.slice(0, 4).map((image) => sharp(image).resize(tile, tile).toBuffer()),
    );
    collage = await sharp({
      create: { width: size, height: size, channels: 3, background: '#000' },
    })
      .composite(
        tiles.map((input, index) => ({
          input,
          left: (index % 2) * tile,
          top: Math.floor(index / 2) * tile,
        })),
      )
      .png()
      .toBuffer();
  } else {
    collage = await sharp(images[0]).resize(size, size).png().toBuffer();
  }

  const { dominant } = await sharp(collage).stats();
  const background = await sharp(collage)
    .blur(size / 24)
    .modulate({ brightness: 0.55, saturation: 1.3 })
    .png()
    .toBuffer();

  return {
    background: `data:image/png;base64,${background.toString('base64')}`,
    accent: toAccent(dominant.r, dominant.g, dominant.b),
  };
}

/** A deterministic accent colour for artists without any artwork. */
export function accentFromName(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hslToHex(hash % 360, 0.75, 0.62);
}

/** Keeps the hue of a colour but forces it bright and saturated enough to stand out on dark. */
function toAccent(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 16) return '#1DB954'; // Greyscale artwork, fall back to Spotify green.

  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return hslToHex((hue * 60 + 360) % 360, 0.8, 0.65);
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = lightness - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
