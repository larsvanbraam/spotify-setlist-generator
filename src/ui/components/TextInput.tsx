import { Text, useInput } from 'ink';
import { useState } from 'react';

import { theme } from '../theme.ts';

type Props = {
  placeholder?: string;
  onSubmit: (value: string) => void;
};

export function TextInput({ placeholder = '', onSubmit }: Props) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) onSubmit(value.trim());
    } else if (key.backspace || key.delete) {
      setValue((current) => current.slice(0, -1));
    } else if (key.ctrl && input === 'u') {
      setValue('');
    } else if (input && !key.ctrl && !key.meta && !key.escape) {
      setValue((current) => current + input);
    }
  });

  return (
    <Text>
      <Text color={theme.accent}>❯ </Text>
      {value ? <Text>{value}</Text> : <Text color={theme.muted}>{placeholder}</Text>}
      <Text inverse> </Text>
    </Text>
  );
}
