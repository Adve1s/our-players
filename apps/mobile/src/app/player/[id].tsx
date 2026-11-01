import {
  ApiError,
  type GameLogEntry,
  localDate,
  type PlayerResponse,
  type SeasonStatsEntry,
} from '@our-players/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { usePlayer } from '../../api/queries';
import { Caption } from '../../components/caption';
import { Card } from '../../components/card';
import { DayMessageCard } from '../../components/day-message';
import { ErrorState } from '../../components/error-state';
import { MarkToggles } from '../../components/mark-button';
import { Skeleton } from '../../components/skeleton';
import { StatTable } from '../../components/stat-table';
import { dayLabel, pageId, rowLabel, rowText } from '../../lib/format';
import {
  bioRows,
  logCaption,
  playerSubtitle,
  seasonCells,
  seasonHeading,
} from '../../lib/player-page';
import { columns, todayGroups, values } from '../../lib/stat-table';
import { useTheme } from '../../theme';

function Bio({ player }: { player: PlayerResponse }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.sheet,
        overflow: 'hidden',
      }}
    >
      <View style={{ backgroundColor: t.colors.plate, padding: t.space.lg }}>
        <Text accessibilityRole="header" style={{ color: t.colors.onPlate, ...t.type.title }}>
          {`${player.firstName} ${player.lastName}`}
        </Text>
        <Text style={{ color: t.colors.onPlateMuted, ...t.type.meta }}>
          {playerSubtitle(player)}
        </Text>
      </View>
      <View style={{ padding: t.space.lg, gap: t.space.xs }}>
        {bioRows(player, localDate(new Date())).map((row) => (
          // The labels line up at a third of the width; a label too long for it at a large
          // font scale pushes its value along, and a value too long wraps under it.
          <View
            key={row.label}
            accessible
            style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: t.space.md }}
          >
            <Text style={{ minWidth: '30%', color: t.colors.textMuted, ...t.type.body }}>
              {row.label}
            </Text>
            <Text style={{ flexShrink: 1, color: t.colors.text, ...t.type.body }}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Season({ entry }: { entry: SeasonStatsEntry }) {
  const t = useTheme();
  return (
    <Card title={seasonHeading(entry)}>
      {/* Four per row; a value too wide for its quarter at a large font scale takes more room and
          wraps the rest, so a 360 px phone never clips it. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: t.space.md }}>
        {seasonCells(entry).map((cell) => (
          <View
            key={cell.label}
            accessible
            style={{ minWidth: '25%', paddingRight: t.space.md, gap: t.space.xs }}
          >
            <Text style={{ color: t.colors.textMuted, ...t.type.label }}>{cell.label}</Text>
            <Text
              style={{ color: t.colors.text, fontVariant: ['tabular-nums'], ...t.type.heading }}
            >
              {cell.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RecentGames({ player }: { player: PlayerResponse }) {
  const t = useTheme();
  const row = (entry: GameLogEntry) => {
    const caption = logCaption(entry);
    // The log entry is a day row without the player, so the day row's label words it the same way.
    const dayRow = { ...entry, player };
    const label = rowLabel(dayRow, entry.game.status, entry.game[entry.side].abbrev);
    return {
      key: entry.game.id,
      lead: (
        <>
          <Text style={{ color: t.colors.text, ...t.type.bodyStrong }}>
            {dayLabel(entry.game.gameDate)}
          </Text>
          <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>{caption}</Text>
        </>
      ),
      values: entry.type === 'line' ? values(entry.line, 'today') : null,
      text: rowText(dayRow, entry.game.status)[0],
      label: `${caption}, ${label}, open game`,
      onPress: () => router.push(`/game/${entry.game.id}`),
    };
  };
  return (
    <Card title="Recent games">
      {player.gameLog.length > 0 ? (
        // One table per run of the same kind, as on Today; no gap between them.
        <View>
          {todayGroups(player.gameLog).map((group) => (
            <StatTable
              key={group.rows[0]?.game.id}
              columns={group.kind ? columns(group.kind, 'today') : null}
              rows={group.rows.map(row)}
            />
          ))}
        </View>
      ) : (
        <Caption>No games yet.</Caption>
      )}
    </Card>
  );
}

export default function PlayerPage() {
  const t = useTheme();
  const { id: raw } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = pageId(raw);
  const q = usePlayer(id);
  const p = q.data;
  const column = { width: '100%', maxWidth: t.layout.maxWidth, alignSelf: 'center' } as const;

  let body: ReactNode;
  if (p) {
    body = (
      <ScrollView>
        <View style={[column, { padding: t.space.md, gap: t.space.md }]}>
          <Bio player={p} />
          {p.seasonStats.length > 0 ? (
            p.seasonStats.map((e) => <Season key={`${e.seasonType}-${e.season}`} entry={e} />)
          ) : (
            <Card>
              <Caption>No season stats yet.</Caption>
            </Card>
          )}
          <RecentGames player={p} />
        </View>
      </ScrollView>
    );
  } else if (id === null || (q.error instanceof ApiError && q.error.status === 404)) {
    // Trying again can't make the player exist.
    body = (
      <View style={[column, { padding: t.space.md }]}>
        <DayMessageCard text="No such player." />
      </View>
    );
  } else if (q.isError || q.fetchStatus === 'paused') {
    // A paused query never errors: with nothing cached, offline on web reads as "can't reach".
    body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  } else {
    body = <Skeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Stack.Screen
        options={{
          // The title names the page for the web tab and screen readers; the header shows only the toggles.
          title: p ? `${p.firstName} ${p.lastName}` : 'Player',
          headerTitle: '',
          headerRight: p
            ? () => (
                <View style={{ flexDirection: 'row' }}>
                  <MarkToggles player={p} />
                </View>
              )
            : undefined,
        }}
      />
      {body}
    </View>
  );
}
