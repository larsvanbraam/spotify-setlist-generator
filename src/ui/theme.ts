export const theme = {
  accent: '#1DB954',
  accentAlt: '#1ED7C8',
  muted: 'gray',
  error: '#FF5C5C',
  warning: '#F5C542',
} as const;

/** Linearly interpolates between two hex colors, `t` in [0, 1]. */
export function mix(from: string, to: string, t: number): string {
  const parse = (hex: string) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const [a, b] = [parse(from), parse(to)];

  return `#${a
    .map((channel, index) => Math.round(channel + (b[index]! - channel) * t))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}
