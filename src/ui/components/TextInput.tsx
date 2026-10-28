import { Text, useInput } from 'ink';
import { useRef, useState } from 'react';

import { theme } from '../theme.ts';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** Only the active input receives key presses and shows a cursor. */
  isActive?: boolean;
  /** Typed or pasted input that doesn't match is ignored. */
  allow?: RegExp;
  maxLength?: number;
};

/**
 * Single-line text input with the usual terminal editing keys: ←/→ (with alt/option per word),
 * home/end or ctrl+a/ctrl+e, backspace/delete, alt+backspace or ctrl+w to delete a word and
 * ctrl+u to clear.
 */
export function TextInput({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  isActive = true,
  allow,
  maxLength = Infinity,
}: Props) {
  // Refs instead of state: key repeat and fast typing can deliver several key presses before a
  // re-render, and each must build on the previous one.
  const valueRef = useRef(value);
  const cursorRef = useRef(value.length);
  // Re-renders when only the cursor moves.
  const [, setCursor] = useState(cursorRef.current);
  if (valueRef.current !== value) {
    // Changed from outside (or by our own onChange): keep the cursor within bounds.
    valueRef.current = value;
    cursorRef.current = Math.min(cursorRef.current, value.length);
  }

  const update = (nextValue: string, nextCursor: number) => {
    cursorRef.current = Math.max(0, Math.min(nextCursor, nextValue.length));
    setCursor(cursorRef.current);
    if (nextValue !== valueRef.current) {
      valueRef.current = nextValue;
      onChange(nextValue);
    }
  };

  useInput(
    (input, key) => {
      const current = valueRef.current;
      const cursor = cursorRef.current;
      const before = current.slice(0, cursor);
      const after = current.slice(cursor);

      if (key.return) {
        onSubmit();
      } else if (key.leftArrow || (key.meta && input === 'b')) {
        update(current, key.meta || key.ctrl ? wordStart(current, cursor) : cursor - 1);
      } else if (key.rightArrow || (key.meta && input === 'f')) {
        update(current, key.meta || key.ctrl ? wordEnd(current, cursor) : cursor + 1);
      } else if (key.home || (key.ctrl && input === 'a')) {
        update(current, 0);
      } else if (key.end || (key.ctrl && input === 'e')) {
        update(current, current.length);
      } else if (key.backspace && (key.meta || key.ctrl)) {
        const start = wordStart(current, cursor);
        update(current.slice(0, start) + after, start);
      } else if (key.ctrl && input === 'w') {
        const start = wordStart(current, cursor);
        update(current.slice(0, start) + after, start);
      } else if (key.backspace) {
        update(before.slice(0, -1) + after, cursor - 1);
      } else if (key.delete) {
        update(before + after.slice(1), cursor);
      } else if (key.ctrl && input === 'u') {
        update('', 0);
      } else if (input && !key.ctrl && !key.meta && !key.escape && !key.tab) {
        if (allow && !allow.test(input)) return;
        const inserted = input.slice(0, Math.max(0, maxLength - current.length));
        update(before + inserted + after, cursor + inserted.length);
      }
    },
    { isActive },
  );

  const cursor = cursorRef.current;

  return (
    <Text>
      <Text color={isActive ? theme.accent : theme.muted}>❯ </Text>
      {value || isActive ? (
        <Text>
          {value.slice(0, cursor)}
          {isActive && <Text inverse>{value[cursor] ?? ' '}</Text>}
          {value.slice(isActive ? cursor + 1 : cursor)}
        </Text>
      ) : null}
      {!value && <Text color={theme.muted}>{placeholder}</Text>}
    </Text>
  );
}

/** Index where the word before the cursor starts, skipping whitespace first. */
function wordStart(value: string, cursor: number): number {
  let index = cursor;
  while (index > 0 && /\s/.test(value[index - 1]!)) index--;
  while (index > 0 && !/\s/.test(value[index - 1]!)) index--;
  return index;
}

/** Index where the word after the cursor ends, skipping whitespace first. */
function wordEnd(value: string, cursor: number): number {
  let index = cursor;
  while (index < value.length && /\s/.test(value[index]!)) index++;
  while (index < value.length && !/\s/.test(value[index]!)) index++;
  return index;
}
