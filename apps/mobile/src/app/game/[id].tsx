import { ApiError } from '@our-players/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useGame } from '../../api/queries';
import { Caption } from '../../components/caption';
import { Card } from '../../components/card';
import { DayMessageCard } from '../../components/day-message';
import { ErrorState } from '../../components/error-state';
import { PeriodTableView } from '../../components/period-table';
import { PlayerRow } from '../../components/player-row';
import { Skeleton } from '../../components/skeleton';
import { scoreText, statusLabel } from '../../lib/format';
import { boxSections, gameWhen, pageId, periodTable } from '../../lib/game-page';
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

  let body: ReactNode;
  if (g) {
    const table = periodTable(g);
    const sections = boxSections(g);
    body = (
      <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.md }}>
        <Card>
          <View style={{ gap: t.space.xs }}>
            <Caption>{g.league}</Caption>
            <Text style={{ color: t.colors.text, fontSize: t.font.title, fontWeight: '700' }}>
              {scoreText(g)}
            </Text>
            {/* A scheduled game's status is its start time, which the line below already has. */}
            {g.status === 'SCHEDULED' ? null : (
              <Text style={{ color: t.colors.text, fontSize: t.font.body }}>{statusLabel(g)}</Text>
            )}
            <Caption>{gameWhen(g)}</Caption>
          </View>
          {table ? <PeriodTableView table={table} /> : null}
        </Card>
        {sections.length > 0 ? (
          sections.map((s) => (
            <Card key={s.side} title={s.abbrev}>
              {s.rows.map((row) => (
                <PlayerRow
                  key={row.player.id}
                  row={row}
                  status={g.status}
                  team={s.abbrev}
                  marked={row.shown}
                />
              ))}
            </Card>
          ))
        ) : (
          <Card>
            <Caption>No box score yet.</Caption>
          </Card>
        )}
      </ScrollView>
    );
  } else if (id === null || (q.error instanceof ApiError && q.error.status === 404)) {
    // Trying again can't make the game exist.
    body = (
      <View style={{ padding: t.space.lg }}>
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
