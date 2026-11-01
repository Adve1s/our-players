import type { DayGameResponse } from '@our-players/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { rowLabel, rowText, scoreText, statusLabel } from '../lib/format';
import { columns, todayGroups, values } from '../lib/stat-table';
import { useTheme } from '../theme';
import { Plate } from './plate';
import { StatTable } from './stat-table';

export function GameCard({ game }: { game: DayGameResponse }) {
  const t = useTheme();
  const status = statusLabel(game);
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.sheet,
        overflow: 'hidden',
      }}
    >
      <Plate
        away={game.away}
        home={game.home}
        status={status}
        league={game.league}
        onPress={() => router.push(`/game/${game.id}`)}
        accessibilityLabel={`${game.league}, ${scoreText(game)}, ${status}, open game`}
      />
      {/* Rows bring their own 48 px height, so the box barely pads them; Other games has none. */}
      {game.rows.length > 0 ? (
        <View style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.xs }}>
          {todayGroups(game.rows).map((group) => (
            <StatTable
              key={group.rows[0]?.player.id}
              columns={group.kind ? columns(group.kind, 'today') : null}
              rows={group.rows.map((row) => {
                const team = game[row.side].abbrev;
                return {
                  key: row.player.id,
                  lead: (
                    <Text style={{ color: t.colors.text, ...t.type.bodyStrong }}>
                      {`${row.player.firstName} ${row.player.lastName} `}
                      <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>{team}</Text>
                    </Text>
                  ),
                  values: row.type === 'line' ? values(row.line, 'today') : null,
                  text: rowText(row, game.status)[0],
                  label: rowLabel(row, game.status, team),
                  onPress: () => router.push(`/player/${row.player.id}`),
                };
              })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
