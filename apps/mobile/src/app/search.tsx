import type { PlayerSummary } from '@our-players/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSearch } from '../api/queries';
import { ErrorState } from '../components/error-state';
import { PlayerItem } from '../components/player-item';
import { SearchField } from '../components/search-field';
import { SEARCH_MAX, searchTerm, searchView } from '../lib/players';
import { markOf } from '../state/prefs';
import { usePrefs } from '../state/prefs-store';
import { useTheme } from '../theme';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function Caption({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{children}</Text>;
}

function MarkButton({
  label,
  checked,
  text,
  onPress,
}: {
  label: string;
  checked: boolean;
  text: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minWidth: t.space.xl * 2,
        minHeight: t.space.xl * 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: checked ? t.colors.accent : t.colors.textMuted,
          fontSize: t.font.body,
          fontWeight: '600',
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}

function ResultItem({ player }: { player: PlayerSummary }) {
  const mark = usePrefs((s) => markOf(s, player.id));
  const toggleFavorite = usePrefs((s) => s.toggleFavorite);
  const toggleHidden = usePrefs((s) => s.toggleHidden);
  const name = `${player.firstName} ${player.lastName}`;
  return (
    <PlayerItem player={player}>
      <View style={{ flexDirection: 'row' }}>
        <MarkButton
          label={`Favorite ${name}`}
          checked={mark === 'favorite'}
          text={mark === 'favorite' ? '★' : '☆'}
          onPress={() => toggleFavorite(player.id)}
        />
        <MarkButton
          label={`Hide ${name}`}
          checked={mark === 'hidden'}
          text={mark === 'hidden' ? 'Hidden' : 'Hide'}
          onPress={() => toggleHidden(player.id)}
        />
      </View>
    </PlayerItem>
  );
}

export default function Search() {
  const t = useTheme();
  const leagues = usePrefs((s) => s.leagues);
  const [query, setQuery] = useState('');
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
        {result.data?.players.map((p) => (
          <ResultItem key={p.id} player={p} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        label="Search players"
        maxLength={SEARCH_MAX}
      />
      <View
        style={{
          backgroundColor: t.colors.surface,
          borderRadius: t.radius,
          padding: t.space.lg,
          gap: t.space.md,
        }}
      >
        {body}
      </View>
    </ScrollView>
  );
}
