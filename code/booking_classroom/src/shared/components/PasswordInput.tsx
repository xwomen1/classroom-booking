import React from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';

const MASK = '•';

export function PasswordInput({
  value,
  onChangeText,
  secureTextEntry: _secureTextEntry,
  ...props
}: TextInputProps) {
  const text = value ?? '';

  if (Platform.OS !== 'android') {
    return (
      <TextInput
        {...props}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        secureTextEntry
        textContentType="password"
        value={text}
      />
    );
  }

  const masked = MASK.repeat(text.length);
  return (
    <TextInput
      {...props}
      autoCapitalize="none"
      autoComplete="off"
      autoCorrect={false}
      importantForAutofill="no"
      onChangeText={next => {
        onChangeText?.(applyPasswordEdit(text, next ?? ''));
      }}
      secureTextEntry={false}
      selection={{ start: masked.length, end: masked.length }}
      spellCheck={false}
      textContentType="none"
      value={masked}
    />
  );
}

function applyPasswordEdit(current: string, displayed: string): string {
  if (
    displayed.length < current.length &&
    [...displayed].every(char => char === MASK)
  ) {
    return current.slice(0, displayed.length);
  }
  if (displayed.startsWith(MASK.repeat(current.length))) {
    return current + displayed.slice(current.length).split(MASK).join('');
  }
  let result = '';
  let sourceIndex = 0;
  for (const char of displayed) {
    if (char === MASK && sourceIndex < current.length) {
      result += current[sourceIndex];
      sourceIndex += 1;
    } else if (char !== MASK) {
      result += char;
    }
  }
  return result;
}
