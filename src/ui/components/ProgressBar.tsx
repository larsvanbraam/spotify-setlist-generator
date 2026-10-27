import { Text } from 'ink';

import { mix, theme } from '../theme.ts';

export function ProgressBar({
  value,
  total,
  width = 36,
}: {
  value: number;
  total: number;
  width?: number;
}) {
  const filled = total === 0 ? 0 : Math.round((value / total) * width);

  return (
    <Text>
      {Array.from({ length: filled }, (_, index) => (
        <Text key={index} color={mix(theme.accent, theme.accentAlt, index / width)}>
          █
        </Text>
      ))}
      <Text color={theme.muted}>{'░'.repeat(width - filled)}</Text>
      <Text color={theme.muted}>
        {'  '}
        {value}/{total}
      </Text>
    </Text>
  );
}
