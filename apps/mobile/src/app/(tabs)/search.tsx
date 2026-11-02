import type { PlayerSummary } from '@our-players/shared';
import { useSegments } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSearch } from '../../api/queries';
import { Caption } from '../../components/caption';
import { Card } from '../../components/card';
import { ErrorState } from '../../components/error-state';
import { MarkToggles } from '../../components/mark-button';
import { PlayerItem } from '../../components/player-item';
import { SearchField } from '../../components/search-field';
import { SEARCH_MAX, searchTerm, searchView } from '../../lib/players';
import { markOf } from '../../state/prefs';
import { usePrefs } from '../../state/prefs-store';
import { useTheme } from '../../theme';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function ResultItem({ player, first }: { player: PlayerSummary; first: boolean }) {
  const mark = usePrefs((s) => markOf(s, player.id));
  return (
    // The card's top edge already bounds the first row; a hidden player's name dims like a removed one.
    <PlayerItem player={player} divider={!first} dimmed={mark === 'hidden'}>
      <MarkToggles player={player} />
    </PlayerItem>
  );
}

export default function Search() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const leagues = usePrefs((s) => s.leagues);
  const [query, setQuery] = useState('');
  // Switching to another tab clears the search; opening a player over it keeps it for Back.
  const segments = useSegments();
  const otherTab = segments[0] === '(tabs)' && segments[1] !== 'search';
  useEffect(() => {
    if (otherTab) setQuery('');
  }, [otherTab]);
  const term = searchTerm(useDebounced(query, 300));
  const result = useSearch(term, leagues);
  const view = searchView(term, result);

  let body: ReactNode;
  if (view === 'hint') {
    body = <Caption>Type at least 2 letters of a player's name.</Caption>;
  } else if (view === 'offline') {
    // shortcut: only web detects offline (no NetInfo, S09), on Android an offline fetch fails and shows the error; add NetInfo if Android needs the offline state.
    body = <Caption>You're offline. Search works when you're back online.</Caption>;
  } else if (view === 'error') {
    body = <ErrorState error={result.error} onRetry={() => void result.refetch()} />;
  } else if (view === 'loading') {
    body = <ActivityIndicator color={t.colors.accent} />;
  } else if (view === 'empty') {
    body = <Caption>No player matches "{term}".</Caption>;
  } else {
    // No gap between rows: each PlayerItem draws its own divider.
    body = (
      <View>
        {result.data?.players.map((p, i) => (
          <ResultItem key={p.id} player={p} first={i === 0} />
        ))}
      </View>
    );
  }

  // The tab hides the navigator's header, so the status bar inset is the screen's own.
  return (
    <ScrollView
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[t.column, { padding: t.space.lg, gap: t.space.lg }]}>
        <Text accessibilityRole="header" style={{ color: t.colors.text, ...t.type.title }}>
          Search
        </Text>
        <SearchField
          value={query}
          onChangeText={setQuery}
          label="Search players"
          maxLength={SEARCH_MAX}
        />
        <Card>{body}</Card>
      </View>
    </ScrollView>
  );
}
