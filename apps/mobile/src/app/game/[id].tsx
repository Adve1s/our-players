import { ApiError, type BoxScoreRow } from '@our-players/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useGame } from '../../api/queries';
import { Caption } from '../../components/caption';
import { Card } from '../../components/card';
import { DayMessageCard } from '../../components/day-message';
import { ErrorState } from '../../components/error-state';
import { PeriodTableView } from '../../components/period-table';
import { Plate } from '../../components/plate';
import { Skeleton } from '../../components/skeleton';
import { StatTable, type StatTableRow } from '../../components/stat-table';
import { pageId, rowLabel, rowText, scoreText, statusLabel } from '../../lib/format';
import { boxSections, gameWhen, periodTable } from '../../lib/game-page';
import { boxGroups, type ColumnSet, columns, todayGroups, values } from '../../lib/stat-table';
import { usePrefs } from '../../state/prefs-store';
import { useTheme } from '../../theme';

export default function GamePage() {
  const t = useTheme();
  const { id: raw } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = pageId(raw);
  const leagues = usePrefs((s) => s.leagues);
  const countries = usePrefs((s) => s.countries);
  const favorites = usePrefs((s) => s.favorites);
  const hidden = usePrefs((s) => s.hidden);
  const q = useGame(id, { leagues, countries, favorites, hidden });
  const g = q.data;

  const box = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.sheet,
    overflow: 'hidden',
  } as const;

  let body: ReactNode;
  if (g) {
    const table = periodTable(g);
    // null period scores: a schedule-only game, whose rows are upcoming ones, shown as on Today.
    const upcoming = g.periodScores === null;
    const sections = upcoming ? [] : boxSections(g);
    // A box-score row leaves the team out (its box is headed by it); an upcoming row names it, as on Today.
    const tableRow = (row: BoxScoreRow, team: string, set: ColumnSet): StatTableRow => ({
      key: row.player.id,
      lead: (
        <Text style={{ color: t.colors.text, ...t.type.bodyStrong }}>
          {`${row.player.firstName} ${row.player.lastName}`}
          {set === 'today' ? (
            <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>{` ${team}`}</Text>
          ) : null}
        </Text>
      ),
      values: row.type === 'line' ? values(row.line, set) : null,
      text: rowText(row, g.status)[0],
      label: `${rowLabel(row, g.status, team)}${row.shown ? ', your player' : ''}`,
      onPress: () => router.push(`/player/${row.player.id}`),
      marked: row.shown,
    });
    const noBox = (
      <Card>
        <Caption>No box score yet.</Caption>
      </Card>
    );
    body = (
      <ScrollView>
        <View style={[t.column, { padding: t.space.md, gap: t.space.md }]}>
          <View style={box}>
            <Plate
              away={g.away}
              home={g.home}
              status={statusLabel(g)}
              league={g.league}
              size="page"
              when={gameWhen(g)}
            />
            {table ? (
              <View style={{ padding: t.space.lg }}>
                <PeriodTableView table={table} />
              </View>
            ) : null}
            {upcoming && g.rows.length > 0 ? (
              <View style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.xs }}>
                {todayGroups(g.rows).map((group) => (
                  <StatTable
                    key={group.rows[0]?.player.id}
                    columns={group.kind ? columns(group.kind, 'today') : null}
                    rows={group.rows.map((row) => tableRow(row, g[row.side].abbrev, 'today'))}
                  />
                ))}
              </View>
            ) : null}
          </View>
          {sections.map((s) => (
            <View key={s.side} style={[box, { paddingTop: t.space.lg }]}>
              <Text
                accessibilityRole="header"
                style={{
                  color: t.colors.text,
                  ...t.type.heading,
                  paddingHorizontal: t.space.lg,
                  paddingBottom: t.space.sm,
                }}
              >
                {s.abbrev}
              </Text>
              {boxGroups(s.rows).map((group) => (
                <StatTable
                  key={group.kind ?? 'text'}
                  scroll
                  columns={group.kind ? columns(group.kind, 'box') : null}
                  rows={group.rows.map((row) => tableRow(row, s.abbrev, 'box'))}
                />
              ))}
            </View>
          ))}
          {(upcoming ? g.rows.length === 0 : sections.length === 0) ? noBox : null}
        </View>
      </ScrollView>
    );
  } else if (id === null || (q.error instanceof ApiError && q.error.status === 404)) {
    // Trying again can't make the game exist.
    body = (
      <View style={[t.column, { padding: t.space.md }]}>
        <DayMessageCard text="No such game." />
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
      <Stack.Screen options={{ title: g ? scoreText(g) : 'Game' }} />
      {body}
    </View>
  );
}
