import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

// Settings heads its cards at title size; the player and game pages' sections read as body text.
export function Card({
  title,
  aside,
  large = false,
  children,
}: {
  title?: string;
  aside?: string;
  large?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius,
        padding: t.space.lg,
        gap: t.space.md,
      }}
    >
      {title ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: t.colors.text,
              fontSize: large ? t.font.title : t.font.body,
              fontWeight: '600',
            }}
          >
            {title}
          </Text>
          {aside ? (
            <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{aside}</Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
