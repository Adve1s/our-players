import {
  ApiError,
  type GameLogEntry,
  localDate,
  type PlayerResponse,
  type SeasonStatsEntry,
} from '@our-players/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { usePlayer } from '../../api/queries';
import { Caption } from '../../components/caption';
import { Card } from '../../components/card';
import { DayMessageCard } from '../../components/day-message';
import { ErrorState } from '../../components/error-state';
import { MarkToggles } from '../../components/mark-button';
import { Skeleton } from '../../components/skeleton';
import { pageId, rowLabel } from '../../lib/format';
import { bioLines, logCaption, logLines, seasonCells, seasonHeading } from '../../lib/player-page';
import { useTheme } from '../../theme';

function Bio({ player }: { player: PlayerResponse }) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.md }}>
        <View style={{ flex: 1, gap: t.space.xs }}>
          <Text style={{ color: t.colors.text, fontSize: t.font.title, fontWeight: '700' }}>
            {`${player.firstName} ${player.lastName}`}
          </Text>
          {bioLines(player, localDate(new Date())).map((line) => (
            <Text key={line} style={{ color: t.colors.textMuted, fontSize: t.font.body }}>
              {line}
            </Text>
          ))}
        </View>
        {/* Search's pair: the star on the edge, Hide beside it; the targets reach into the padding. */}
        <View style={{ flexDirection: 'row', marginTop: -t.space.md }}>
          <MarkToggles player={player} />
        </View>
      </View>
    </Card>
  );
}

function Season({ entry }: { entry: SeasonStatsEntry }) {
  const t = useTheme();
  return (
    <Card title={seasonHeading(entry)}>
      {/* Four per row and wrapping, so a large font scale still fits a 360 px phone. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: t.space.md }}>
        {seasonCells(entry).map((cell) => (
          <View key={cell.label} accessible style={{ width: '25%', gap: t.space.xs }}>
            <Caption>{cell.label}</Caption>
            <Text style={{ color: t.colors.text, fontSize: t.font.body, fontWeight: '600' }}>
              {cell.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function LogRow({ entry, player }: { entry: GameLogEntry; player: PlayerResponse }) {
  const t = useTheme();
  const caption = logCaption(entry);
  // The log entry is a day row without the player, so the day row's label words it the same way.
  const label = rowLabel({ ...entry, player }, entry.game.status, entry.game[entry.side].abbrev);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${caption}, ${label}, open game`}
      onPress={() => router.push(`/game/${entry.game.id}`)}
      // The 48 px target reaches into the card's gaps, so one-line and two-line rows space alike.
      style={{ gap: t.space.xs, paddingVertical: t.space.sm, marginVertical: -t.space.sm }}
    >
      <Caption>{caption}</Caption>
      {logLines(entry).map((line) => (
        <Text
          key={line}
          style={{
            color: entry.type === 'line' ? t.colors.text : t.colors.textMuted,
            fontSize: t.font.body,
          }}
        >
          {line}
        </Text>
      ))}
    </Pressable>
  );
}

export default function PlayerPage() {
  const t = useTheme();
  const { id: raw } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = pageId(raw);
  const q = usePlayer(id);
  const p = q.data;

  let body: ReactNode;
  if (p) {
    body = (
      <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.md }}>
        <Bio player={p} />
        {p.seasonStats.length > 0 ? (
          p.seasonStats.map((e) => <Season key={`${e.seasonType}-${e.season}`} entry={e} />)
        ) : (
          <Card>
            <Caption>No season stats yet.</Caption>
          </Card>
        )}
        <Card title="Recent games">
          {p.gameLog.length > 0 ? (
            p.gameLog.map((e) => <LogRow key={e.game.id} entry={e} player={p} />)
          ) : (
            <Caption>No games yet.</Caption>
          )}
        </Card>
      </ScrollView>
    );
  } else if (id === null || (q.error instanceof ApiError && q.error.status === 404)) {
    // Trying again can't make the player exist.
    body = (
      <View style={{ padding: t.space.lg }}>
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
      <Stack.Screen options={{ title: p ? `${p.firstName} ${p.lastName}` : 'Player' }} />
      {body}
    </View>
  );
}
