import type { DayGameResponse } from '@our-players/shared';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { scoreText, statusLabel } from '../lib/format';
import { useTheme } from '../theme';
import { PlayerRow } from './player-row';

export function GameCard({ game, compact = false }: { game: DayGameResponse; compact?: boolean }) {
  const t = useTheme();
  const score = scoreText(game);
  const status = statusLabel(game);
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.sheet,
        paddingHorizontal: t.space.lg,
        paddingVertical: compact ? t.space.md : t.space.lg,
        gap: t.space.md,
      }}
    >
      {/* The 48 px target reaches into the card's padding and the gap below, so the card barely grows. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${game.league}, ${score}, ${status}, open game`}
        onPress={() => router.push(`/game/${game.id}`)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          minHeight: t.space.xl * 2,
          marginVertical: -t.space.md,
        }}
      >
        <Text style={{ color: t.colors.textMuted, ...t.type.label }}>{game.league}</Text>
        <Text style={{ flex: 1, color: t.colors.text, ...t.type.bodyStrong }}>{score}</Text>
        <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>{status}</Text>
      </Pressable>
      {game.rows.map((row) => (
        <PlayerRow
          key={row.player.id}
          row={row}
          status={game.status}
          team={game[row.side].abbrev}
        />
      ))}
    </View>
  );
}
