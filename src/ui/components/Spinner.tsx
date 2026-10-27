import { Text, useAnimation } from 'ink';

import { theme } from '../theme.ts';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function Spinner({ label }: { label: string }) {
  const { frame } = useAnimation({ interval: 80 });

  return (
    <Text>
      <Text color={theme.accent}>{FRAMES[frame % FRAMES.length]}</Text> {label}
    </Text>
  );
}
