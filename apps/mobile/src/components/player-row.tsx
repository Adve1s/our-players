import type { GameStatus, PlayerRow as Row } from '@our-players/shared';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { rowLabel, rowText } from '../lib/format';
import { useTheme } from '../theme';

const BAR = 3;

// One component for all four row kinds; the screen reader gets the spelled-out label as one item.
// `marked` (your player in a full box score) draws a bar in the card's padding, so names stay aligned.
export function PlayerRow({
  row,
  status,
  team,
  marked = false,
}: {
  row: Row;
  status: GameStatus;
  team: string;
  marked?: boolean;
}) {
  const t = useTheme();
  return (
    // The 48 px target reaches into the gaps around the row, so the card keeps Today's spacing.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rowLabel(row, status, team)}${marked ? ', your player' : ''}`}
      onPress={() => router.push(`/player/${row.player.id}`)}
      style={{ paddingVertical: t.space.xs, marginVertical: -t.space.xs }}
    >
      <View
        style={{
          gap: t.space.xs,
          ...(marked && {
            borderLeftWidth: BAR,
            borderLeftColor: t.colors.accent,
            paddingLeft: t.space.sm,
            marginLeft: -(t.space.sm + BAR),
          }),
        }}
      >
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
    </Pressable>
  );
}
