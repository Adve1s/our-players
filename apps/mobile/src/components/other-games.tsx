import Ionicons from '@expo/vector-icons/Ionicons';
import type { DayGameResponse } from '@our-players/shared';
import { router } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { scoreText, statusLabel } from '../lib/format';
import { useReducedMotion, useTheme } from '../theme';

// Collapsed on mount; the screen keys it by date so each new day starts collapsed.
export function OtherGames({ games }: { games: DayGameResponse[] }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  // Before paint, so a reopened list never shows a frame at its old opacity.
  useLayoutEffect(() => {
    if (!open) return;
    if (reduced) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    // Web has no native animated module.
    const anim = Animated.timing(fade, {
      toValue: 1,
      duration: t.motion.expand,
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [open, reduced, fade, t.motion.expand]);
  const title = `Other games (${games.length})`;
  return (
    <View style={{ gap: t.space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        aria-expanded={open}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: t.layout.target,
          paddingHorizontal: t.space.xs,
          opacity: pressed ? t.opacity.pressed : 1,
        })}
      >
        <Text style={{ color: t.colors.text, ...t.type.heading }}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={t.icon.inline}
          color={t.colors.textMuted}
        />
      </Pressable>
      {open ? (
        <Animated.View
          style={{
            opacity: fade,
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.sheet,
            paddingHorizontal: t.space.lg,
          }}
        >
          {games.map((g, i) => {
            const score = scoreText(g);
            const status = statusLabel(g);
            return (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityLabel={`${g.league}, ${score}, ${status}, open game`}
                onPress={() => router.push(`/game/${g.id}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  // Wraps at large font scales; alignContent keeps a single line centred in the row.
                  flexWrap: 'wrap',
                  alignContent: 'center',
                  columnGap: t.space.md,
                  minHeight: t.layout.target,
                  paddingVertical: t.space.sm,
                  borderTopWidth: i === 0 ? 0 : t.layout.hairline,
                  borderTopColor: t.colors.border,
                  opacity: pressed ? t.opacity.pressed : 1,
                })}
              >
                <Text style={{ color: t.colors.textMuted, ...t.type.label }}>{g.league}</Text>
                <Text
                  style={{
                    flex: 1,
                    color: t.colors.text,
                    fontVariant: ['tabular-nums'],
                    ...t.type.bodyStrong,
                  }}
                >
                  {score}
                </Text>
                <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>{status}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}
