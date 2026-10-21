import { useState } from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '../theme';

export function SearchField({
  value,
  onChangeText,
  label,
  maxLength,
}: {
  value: string;
  onChangeText: (s: string) => void;
  label: string;
  maxLength?: number;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={label}
      accessibilityLabel={label}
      maxLength={maxLength}
      autoCorrect={false}
      placeholderTextColor={t.colors.textMuted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        color: t.colors.text,
        fontSize: t.font.body,
        borderWidth: 1,
        // The accent border is the focus indicator; a 0-width solid outline hides the browser's (style auto ignores width).
        borderColor: focused ? t.colors.accent : t.colors.border,
        outlineStyle: 'solid',
        outlineWidth: 0,
        borderRadius: t.radius,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.sm,
      }}
    />
  );
}
