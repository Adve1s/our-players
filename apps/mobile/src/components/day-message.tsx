import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

type Action = { label: string; onPress: () => void };

// The empty/info card for the day states; the wording comes from lib/day-message.
export function DayMessageCard({ text, action }: { text: string; action?: Action }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius,
        padding: t.space.lg,
        gap: t.space.md,
        alignItems: 'flex-start',
      }}
    >
      <Text style={{ color: t.colors.text, fontSize: t.font.body }}>{text}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={{
            backgroundColor: t.colors.accent,
            borderRadius: t.radius,
            minHeight: t.space.xl * 2,
            justifyContent: 'center',
            paddingVertical: t.space.sm,
            paddingHorizontal: t.space.lg,
          }}
        >
          <Text style={{ color: t.colors.onAccent, fontSize: t.font.body, fontWeight: '600' }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
