import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

function Heading({ title, aside }: { title: string; aside?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text accessibilityRole="header" style={{ color: t.colors.text, ...t.type.heading }}>
        {title}
      </Text>
      {aside ? <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>{aside}</Text> : null}
    </View>
  );
}

export function Card({
  title,
  aside,
  children,
}: {
  title?: string;
  aside?: string;
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
      {title ? <Heading title={title} aside={aside} /> : null}
      {children}
    </View>
  );
}

// A list screen's section: the heading sits above its box, as "Other games" does on Today.
export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.sm }}>
      <View style={{ paddingHorizontal: t.space.xs }}>
        <Heading title={title} aside={aside} />
      </View>
      <Card>{children}</Card>
    </View>
  );
}
