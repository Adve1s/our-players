import Ionicons from '@expo/vector-icons/Ionicons';
import { useLayoutEffect, useRef } from 'react';
import { Animated, Platform, Pressable, Text } from 'react-native';
import { dayLabel } from '../lib/format';
import { useReducedMotion, useTheme } from '../theme';

// Floats over the list, above the tab bar; the screen mounts it only off the latest day.
export function LatestPill({ date, onPress }: { date: string; onPress: () => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  // Before paint, so it never shows a frame at full opacity before fading in.
  useLayoutEffect(() => {
    if (reduced) {
      fade.setValue(1);
      return;
    }
    // Web has no native animated module.
    const anim = Animated.timing(fade, {
      toValue: 1,
      duration: t.motion.expand,
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, fade, t.motion.expand]);
  return (
    <Animated.View
      style={{ position: 'absolute', bottom: t.space.lg, alignSelf: 'center', opacity: fade }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Latest game day"
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          minHeight: t.layout.target,
          paddingHorizontal: t.space.lg,
          backgroundColor: t.colors.inverse,
          borderRadius: t.radius.full,
          boxShadow: t.shadow.float,
          opacity: pressed ? t.opacity.pressed : 1,
        })}
      >
        <Text style={{ color: t.colors.onInverse, ...t.type.bodyStrong }}>
          {`Latest: ${dayLabel(date)}`}
        </Text>
        <Ionicons name="chevron-forward" size={t.icon.inline} color={t.colors.onInverse} />
      </Pressable>
    </Animated.View>
  );
}
