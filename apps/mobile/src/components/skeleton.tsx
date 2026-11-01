import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { useReducedMotion, useTheme } from '../theme';

// Today, the player page and the game page all load as two game-box shapes: a plate over three rows.
export function Skeleton() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pulse.setValue(1);
    if (reduced) return;
    const half = t.motion.pulse / 2;
    // Web has no native animated module.
    const native = Platform.OS !== 'web';
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: t.opacity.dimmed,
          duration: half,
          useNativeDriver: native,
        }),
        Animated.timing(pulse, { toValue: 1, duration: half, useNativeDriver: native }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, pulse, t.motion.pulse, t.opacity.dimmed]);
  const line = (width: `${number}%`) => (
    <View
      style={{
        height: t.space.md,
        width,
        backgroundColor: t.colors.border,
        borderRadius: t.radius.full,
      }}
    />
  );
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{ padding: t.space.lg, gap: t.space.md, opacity: pulse }}
    >
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.sheet,
            overflow: 'hidden',
          }}
        >
          <View style={{ height: t.layout.target + t.space.xl, backgroundColor: t.colors.plate }} />
          <View style={{ padding: t.space.lg, gap: t.space.lg }}>
            {line('70%')}
            {line('85%')}
            {line('55%')}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
