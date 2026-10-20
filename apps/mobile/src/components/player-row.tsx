import type { GameStatus, PlayerRow as Row } from '@our-players/shared';
import { Text, View } from 'react-native';
import { rowLabel, rowText } from '../lib/format';
import { useTheme } from '../theme';

// One component for all four row kinds; the screen reader gets the spelled-out label as one item.
export function PlayerRow({ row, status, team }: { row: Row; status: GameStatus; team: string }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={rowLabel(row, status, team)} style={{ gap: t.space.xs }}>
      <Text style={{ color: t.colors.text, fontSize: t.font.body, fontWeight: '600' }}>
        {`${row.player.firstName} ${row.player.lastName}  `}
        <Text style={{ color: t.colors.textMuted, fontWeight: '400' }}>{team}</Text>
      </Text>
      {rowText(row, status).map((line) => (
        <Text
          key={line}
          style={{
            color: row.type === 'line' ? t.colors.text : t.colors.textMuted,
            fontSize: t.font.body,
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}
