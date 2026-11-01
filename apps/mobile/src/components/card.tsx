import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Card({
  title,
  aside,
  children,
}: {
  title?: string;
  aside?: string;
  // shortcut: ignored since every title is a heading; Settings still passes it until Task 10 removes it.
  large?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.sheet,
        padding: t.space.lg,
        gap: t.space.md,
      }}
    >
      {title ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text accessibilityRole="header" style={{ color: t.colors.text, ...t.type.heading }}>
            {title}
          </Text>
          {aside ? (
            <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>{aside}</Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
