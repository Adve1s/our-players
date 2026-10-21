import type { DayGameResponse } from '@our-players/shared';
import { Text, View } from 'react-native';
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
        borderRadius: t.radius,
        paddingHorizontal: t.space.lg,
        paddingVertical: compact ? t.space.md : t.space.lg,
        gap: t.space.md,
      }}
    >
      <View
        accessible
        accessibilityLabel={`${game.league}, ${score}, ${status}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}
      >
        <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption, fontWeight: '600' }}>
          {game.league}
        </Text>
        <Text style={{ flex: 1, color: t.colors.text, fontSize: t.font.body, fontWeight: '600' }}>
          {score}
        </Text>
        <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{status}</Text>
      </View>
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
