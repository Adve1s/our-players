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
      style={({ pressed }) => ({
        backgroundColor: t.colors.accentFill,
        borderRadius: t.radius.control,
        minHeight: t.layout.target,
        justifyContent: 'center',
        paddingVertical: t.space.sm,
        paddingHorizontal: t.space.lg,
        opacity: pressed ? t.opacity.pressed : 1,
      })}
    >
      <Text style={{ color: t.colors.onAccent, textAlign: 'center', ...t.type.bodyStrong }}>
        {label}
      </Text>
    </Pressable>
  );
}
