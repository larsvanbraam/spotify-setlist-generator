import { Box, Text } from 'ink';

import { theme } from '../theme.ts';

export function KeyHints({ hints }: { hints: Array<[key: string, label: string]> }) {
  return (
    <Box marginTop={1} gap={2}>
      {hints.map(([key, label]) => (
        <Text key={key} color={theme.muted}>
          <Text bold color="white">
            {key}
          </Text>{' '}
          {label}
        </Text>
      ))}
    </Box>
  );
}
