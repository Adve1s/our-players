import { Pressable, Text } from 'react-native';
import { useTheme } from '../theme';

// The one filled button; 48 px tall at least, Android's touch-target minimum.
export function AccentButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}
