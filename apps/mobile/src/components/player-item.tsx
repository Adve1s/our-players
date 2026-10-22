import type { PlayerSummary } from '@our-players/shared';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { playerMeta } from '../lib/players';
import { useTheme } from '../theme';

export function PlayerItem({
  player,
  dimmed = false,
  divider = true,
  children,
}: {
  player: PlayerSummary;
  dimmed?: boolean;
  divider?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingVertical: t.space.sm,
        minHeight: t.space.xl * 2,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: t.colors.border,
      }}
    >
      {/* The name opens the player; the buttons beside it keep their own targets. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${player.firstName} ${player.lastName}`}
        onPress={() => router.push(`/player/${player.id}`)}
        style={{
          flex: 1,
          opacity: dimmed ? 0.5 : 1,
          minHeight: t.space.xl * 2,
          justifyContent: 'center',
          marginVertical: -t.space.sm,
        }}
      >
        <Text style={{ color: t.colors.text, fontSize: t.font.body, fontWeight: '600' }}>
          {player.firstName} {player.lastName}
        </Text>
        <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>
          {playerMeta(player)}
        </Text>
      </Pressable>
      {/* The buttons' 48 px touch targets reach into the row's padding, so a row is as tall as a CountryItem. */}
      <View style={{ flexDirection: 'row', marginVertical: -t.space.sm }}>{children}</View>
    </View>
  );
}
