import { Text, useInput } from 'ink';

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

export function TextInput({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  isActive = true,
  allow,
  maxLength = Infinity,
}: Props) {
  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit();
      } else if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
      } else if (key.ctrl && input === 'u') {
        onChange('');
      } else if (input && !key.ctrl && !key.meta && !key.escape && !key.tab) {
        if (!allow || allow.test(input)) onChange((value + input).slice(0, maxLength));
      }
    },
    { isActive },
  );

  return (
    <Text>
      <Text color={isActive ? theme.accent : theme.muted}>❯ </Text>
      {value ? <Text>{value}</Text> : <Text color={theme.muted}>{placeholder}</Text>}
      {isActive && <Text inverse> </Text>}
    </Text>
  );
}
