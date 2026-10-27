import { Box, Text } from 'ink';

import { mix, theme } from '../theme.ts';

const TITLE = '♫  setlist → spotify';

export function Header({ subtitle }: { subtitle?: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" borderColor={theme.accent} paddingX={2} alignSelf="flex-start">
        <Text bold>
          {Array.from(TITLE).map((char, index) => (
            <Text key={index} color={mix(theme.accent, theme.accentAlt, index / TITLE.length)}>
              {char}
            </Text>
          ))}
        </Text>
      </Box>
      {subtitle && (
        <Box paddingX={1}>
          <Text color={theme.muted}>{subtitle}</Text>
        </Box>
      )}
    </Box>
  );
}
