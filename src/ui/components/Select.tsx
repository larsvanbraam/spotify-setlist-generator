import { Box, Text, useInput } from 'ink';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { theme } from '../theme.ts';

type Props<T> = {
  items: Array<T>;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  onSubmit: (item: T) => void;
  onHighlight?: (item: T) => void;
  onCancel?: () => void;
  /** Number of visible rows, the list scrolls beyond that. */
  limit?: number;
  /** Only the active list responds to keys and shows its cursor. */
  isActive?: boolean;
};

export function Select<T>({
  items,
  renderItem,
  onSubmit,
  onHighlight,
  onCancel,
  limit = 10,
  isActive = true,
}: Props<T>) {
  const [index, setIndex] = useState(0);
  // Key repeat can deliver several presses before a re-render, so track the latest index in a ref.
  const indexRef = useRef(index);

  const move = (delta: number) => {
    const nextIndex = Math.max(0, Math.min(items.length - 1, indexRef.current + delta));
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    onHighlight?.(items[nextIndex]!);
  };

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') move(-1);
      else if (key.downArrow || input === 'j') move(1);
      else if (key.pageUp) move(-limit);
      else if (key.pageDown) move(limit);
      else if (key.return) onSubmit(items[indexRef.current]!);
      else if (key.escape) onCancel?.();
    },
    { isActive },
  );

  const offset = Math.max(0, Math.min(index - Math.floor(limit / 2), items.length - limit));
  const visible = items.slice(offset, offset + limit);

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>{offset > 0 ? '  ↑ more' : ' '}</Text>
      {visible.map((item, visibleIndex) => {
        const isSelected = isActive && offset + visibleIndex === index;
        return (
          <Box key={offset + visibleIndex}>
            <Text color={theme.accent}>{isSelected ? '❯ ' : '  '}</Text>
            {renderItem(item, isSelected)}
          </Box>
        );
      })}
      <Text color={theme.muted}>{offset + limit < items.length ? '  ↓ more' : ' '}</Text>
    </Box>
  );
}
