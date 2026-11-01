import type { League, PublicId } from '@our-players/shared';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useCountries, usePlayers } from '../../api/queries';
import { Caption } from '../../components/caption';
import { Card } from '../../components/card';
import { ErrorState } from '../../components/error-state';
import { PlayerItem } from '../../components/player-item';
import { SearchField } from '../../components/search-field';
import { type CountryRow, countryRows } from '../../lib/countries';
import { listIds, listRows, listView } from '../../lib/players';
import { type Mark, markOf } from '../../state/prefs';
import { usePrefs } from '../../state/prefs-store';
import { useTheme } from '../../theme';

const LEAGUES: League[] = ['NHL', 'NBA'];

function CountryItem({ row, onPress }: { row: CountryRow; onPress: () => void }) {
  const t = useTheme();
  const counts = LEAGUES.filter((l) => row.counts[l])
    .map((l) => `${l} ${row.counts[l]}`)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={row.selected}
      accessibilityLabel={row.name}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingVertical: t.space.sm,
        minHeight: t.space.xl * 2,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
      }}
    >
      <Text
        style={{
          color: t.colors.text,
          ...t.type.bodyStrong,
          minWidth: t.space.xl * 2,
        }}
      >
        {row.code}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.text, ...t.type.body }}>{row.name}</Text>
        {counts ? <Caption>{counts}</Caption> : null}
      </View>
      <Text style={{ color: t.colors.accent, ...t.type.heading }}>{row.selected ? '✓' : ''}</Text>
    </Pressable>
  );
}

function PlayerList({
  title,
  mark,
  empty,
  noneShown,
  removed,
  onRemove,
  onUndo,
}: {
  title: string;
  mark: 'favorite' | 'hidden';
  empty: string;
  noneShown: string;
  removed: ReadonlyMap<PublicId, Mark>;
  onRemove: (id: PublicId) => void;
  onUndo: (id: PublicId) => void;
}) {
  const t = useTheme();
  const leagues = usePrefs((s) => s.leagues);
  const list = usePrefs((s) => (mark === 'favorite' ? s.favorites : s.hidden));
  const ids = listIds(list, removed, mark);
  const r = usePlayers(ids);
  const rows = listRows(r.data?.players ?? [], ids, leagues, new Set(removed.keys()));
  const view = listView(ids, r, rows);

  let body: ReactNode;
  if (view === 'empty') {
    body = <Caption>{empty}</Caption>;
  } else if (view === 'offline') {
    body = <Caption>You're offline. Your players load when you're back online.</Caption>;
  } else if (view === 'error') {
    body = <ErrorState error={r.error} onRetry={() => void r.refetch()} />;
  } else if (view === 'loading') {
    body = <ActivityIndicator color={t.colors.accent} />;
  } else if (view === 'none-shown') {
    body = <Caption>{noneShown}</Caption>;
  } else {
    body = (
      <View>
        {rows.map(({ player, removed: gone }) => {
          const name = `${player.firstName} ${player.lastName}`;
          return (
            <PlayerItem key={player.id} player={player} dimmed={gone}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={gone ? `Undo removing ${name}` : `Remove ${name}`}
                onPress={() => (gone ? onUndo(player.id) : onRemove(player.id))}
                style={{
                  minWidth: t.space.xl * 2,
                  minHeight: t.space.xl * 2,
                  // Right-aligned: Remove ↔ Undo keeps the label on the card's edge.
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: t.colors.accent, ...t.type.bodyStrong }}>
                  {gone ? 'Undo' : 'Remove'}
                </Text>
              </Pressable>
            </PlayerItem>
          );
        })}
      </View>
    );
  }

  // No count until the list is in: "0" beside a spinner reads as "your favorites are gone".
  const counted = view === 'empty' || view === 'none-shown' || view === 'rows';
  return (
    <Card
      large
      title={title}
      aside={counted ? `${rows.filter((row) => !row.removed).length}` : undefined}
    >
      {body}
    </Card>
  );
}

export default function Settings() {
  const t = useTheme();
  const leagues = usePrefs((s) => s.leagues);
  const countries = usePrefs((s) => s.countries);
  const toggleLeague = usePrefs((s) => s.toggleLeague);
  const toggleCountry = usePrefs((s) => s.toggleCountry);
  const { data, isPending, isError, error, fetchStatus, refetch } = useCountries();
  const [query, setQuery] = useState('');
  const setMark = usePrefs((s) => s.setMark);
  // The mark each player had before Remove; leaving Settings clears it, so removals become final.
  const [removed, setRemoved] = useState<ReadonlyMap<PublicId, Mark>>(new Map());
  useFocusEffect(useCallback(() => () => setRemoved(new Map()), []));
  const remove = (id: PublicId) => {
    // Read before setMark: React may run the updater after it, and then the old mark is null.
    const prev = markOf(usePrefs.getState(), id);
    setRemoved((m) => new Map(m).set(id, prev));
    setMark(id, null);
  };
  const undo = (id: PublicId) => {
    setMark(id, removed.get(id) ?? null);
    setRemoved((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  };
  // Without data (loading, error) this still lists the selected countries, so they can be unticked.
  const rows = countryRows(data?.countries ?? [], countries, query);

  let status: ReactNode = null;
  if (isPending && fetchStatus === 'paused') {
    // shortcut: only web detects offline (no NetInfo, S09), on Android an offline fetch fails and shows the error; add NetInfo if Android needs the offline state.
    status = <Caption>You're offline. Countries load when you're back online.</Caption>;
  } else if (isPending) {
    status = <ActivityIndicator color={t.colors.accent} />;
  } else if (isError) {
    status = <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <Card large title="Leagues">
        {LEAGUES.map((l) => {
          const on = leagues.includes(l);
          const locked = on && leagues.length === 1;
          return (
            <View
              key={l}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.colors.text, ...t.type.body }}>{l}</Text>
              <Switch
                accessibilityLabel={l}
                value={on}
                disabled={locked}
                onValueChange={() => toggleLeague(l)}
                trackColor={{ true: t.colors.accentFill, false: t.colors.border }}
                thumbColor={on ? t.colors.thumb : t.colors.textMuted}
                // react-native-web takes the "on" thumb from this web-only prop (not in RN's types), else teal.
                {...{ activeThumbColor: t.colors.thumb }}
                // react-native-web draws a disabled switch with the given colors, unchanged.
                style={{ opacity: locked ? t.opacity.disabled : 1 }}
              />
            </View>
          );
        })}
        {leagues.length === 1 ? <Caption>At least one league stays on.</Caption> : null}
      </Card>

      <Card large title="Countries" aside={`${countries.length} selected`}>
        <SearchField value={query} onChangeText={setQuery} label="Search countries" />
        {countries.length === 0 ? (
          <Caption>No countries selected — Today stays empty until you pick one.</Caption>
        ) : null}
        {status}
        {/* No gap between rows: the Card's gap would add a band under each row's text. */}
        {rows.length > 0 ? (
          <View>
            {rows.map((row) => (
              <CountryItem key={row.code} row={row} onPress={() => toggleCountry(row.code)} />
            ))}
          </View>
        ) : null}
        {data && rows.length === 0 && query.trim() ? (
          <Caption>No country matches "{query.trim()}".</Caption>
        ) : null}
      </Card>

      <PlayerList
        title="Favorites"
        mark="favorite"
        empty="No favorites yet. Star players in Search."
        noneShown="None of your favorites play in the leagues you have on."
        removed={removed}
        onRemove={remove}
        onUndo={undo}
      />
      <PlayerList
        title="Hidden"
        mark="hidden"
        empty="Nobody hidden. Hidden players never show on Today."
        noneShown="None of your hidden players play in the leagues you have on."
        removed={removed}
        onRemove={remove}
        onUndo={undo}
      />

      <Card large title="About">
        <Text style={{ color: t.colors.text, ...t.type.bodyStrong }}>Our Players</Text>
        <Caption>{`Version ${Constants.expoConfig?.version}`}</Caption>
        <Caption>Data from the public NHL and ESPN web APIs.</Caption>
        <Caption>Not affiliated with the NHL or NBA.</Caption>
        {/* Web only: on Android the app is already installed. */}
        {Platform.OS === 'web' ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Add to Home Screen"
            onPress={() => router.push('/install')}
            style={{ minHeight: t.space.xl * 2, justifyContent: 'center' }}
          >
            <Text style={{ color: t.colors.accent, ...t.type.bodyStrong }}>Add to Home Screen</Text>
          </Pressable>
        ) : null}
      </Card>
    </ScrollView>
  );
}
