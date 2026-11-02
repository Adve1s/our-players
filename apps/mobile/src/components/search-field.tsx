import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
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
  const border = focused ? 2 * t.layout.hairline : t.layout.hairline;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
        minHeight: t.layout.target,
        backgroundColor: t.colors.surface,
        // The accent border is the focus indicator; the padding takes up its extra width, so the text doesn't move.
        borderWidth: border,
        borderColor: focused ? t.colors.accent : t.colors.border,
        borderRadius: t.radius.control,
        paddingHorizontal: t.space.md + 2 * t.layout.hairline - border,
      }}
    >
      <Ionicons name="search" size={t.icon.inline} color={t.colors.textMuted} />
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
          flex: 1,
          alignSelf: 'stretch',
          color: t.colors.text,
          ...t.type.body,
          // A 0-width solid outline hides the browser's own focus ring (style auto ignores width).
          outlineStyle: 'solid',
          outlineWidth: 0,
          paddingVertical: t.space.sm,
          // Android's own inset would push the text off the icon gap.
          paddingHorizontal: 0,
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          // The icon is small; the slop makes its target full size.
          hitSlop={(t.layout.target - t.icon.inline) / 2}
          style={({ pressed }) => ({ opacity: pressed ? t.opacity.pressed : 1 })}
        >
          <Ionicons name="close-circle" size={t.icon.inline} color={t.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
