import type { DayResponse } from '@our-players/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDay, useMeta } from '../../api/queries';
import { DayMessageCard } from '../../components/day-message';
import { DayStrip } from '../../components/day-strip';
import { ErrorState } from '../../components/error-state';
import { GameCard } from '../../components/game-card';
import { LatestPill } from '../../components/latest-pill';
import { OtherGames } from '../../components/other-games';
import { Skeleton } from '../../components/skeleton';
import { type DayMessage, dayMessage, refreshBanner } from '../../lib/day-message';
import { dateParam, dateParamFor, dayTitle, latestDate } from '../../lib/format';
import { usePrefs } from '../../state/prefs-store';
import { useTheme } from '../../theme';

const ACTION_LABELS = {
  prev: 'Previous game day',
  next: 'Next game day',
  settings: 'Open Settings',
} as const;

function Banner({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: t.space.md,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.sheet,
        paddingHorizontal: t.space.lg,
        paddingVertical: onRetry ? 0 : t.space.md,
      }}
    >
      <Text style={{ flex: 1, color: t.colors.textMuted, ...t.type.meta }}>{text}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={onRetry}
          style={({ pressed }) => ({
            minHeight: t.layout.target,
            justifyContent: 'center',
            opacity: pressed ? t.opacity.pressed : 1,
          })}
        >
          <Text style={{ color: t.colors.accent, ...t.type.bodyStrong }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Today() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const leagues = usePrefs((s) => s.leagues);
  const countries = usePrefs((s) => s.countries);
  const favorites = usePrefs((s) => s.favorites);
  const hidden = usePrefs((s) => s.hidden);
  const { date: rawDate } = useLocalSearchParams<{ date?: string | string[] }>();
  const meta = useMeta();
  const latest = meta.data ? latestDate(meta.data, leagues) : null;
  const param = dateParam(rawDate);
  const date = param ?? latest;
  const day = useDay(date, { leagues, countries, favorites, hidden });
  const [refreshing, setRefreshing] = useState(false);
  // TanStack drops the placeholder when a new key errors, so the screen keeps the last day itself.
  const last = useRef<DayResponse | undefined>(undefined);
  useEffect(() => {
    if (day.data && !day.isPlaceholderData) last.current = day.data;
  }, [day.data, day.isPlaceholderData]);
  // shortcut: reads a ref during render (React forbids it; the React Compiler already skips Today), keep the last day in state if Today is ever made compilable.
  const data = day.data ?? (day.isLoadingError ? last.current : undefined);

  const retry = () => {
    void meta.refetch();
    if (date !== null) void day.refetch();
  };

  // Only the pull shows the spinner; focus refetches stay silent.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([meta.refetch(), day.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  // The same date is no URL change, so a step back toward a day that failed would do nothing.
  const go = (d: string) =>
    d === date ? retry() : router.setParams({ date: dateParamFor(d, latest) });
  // The tab hides the navigator's header, so the status bar inset is the screen's own.
  const screen = (child: ReactNode) => (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: t.colors.background }}>
      {child}
    </View>
  );
  const column = { width: '100%', maxWidth: t.layout.maxWidth, alignSelf: 'center' } as const;
  // Without a day yet there is no date to name, so the title is just "Today".
  const header = (d: string | null) => (
    <View style={[column, { paddingHorizontal: t.space.lg, paddingVertical: t.space.lg }]}>
      {d === null ? null : <Text style={{ color: t.colors.textMuted, ...t.type.meta }}>Today</Text>}
      <Text accessibilityRole="header" style={{ color: t.colors.text, ...t.type.title }}>
        {d === null ? 'Today' : dayTitle(d)}
      </Text>
    </View>
  );

  if (!data) {
    // A paused query never errors: with nothing cached, offline on web reads as "can't reach".
    const offline = meta.fetchStatus === 'paused' || day.fetchStatus === 'paused';
    const bare = (child: ReactNode) =>
      screen(
        <>
          {header(date)}
          {child}
        </>,
      );
    if (date === null) {
      // Meta is in but no selected league has a game day.
      if (meta.data)
        return bare(
          <View style={{ padding: t.space.lg }}>
            <DayMessageCard text="No games yet." />
          </View>,
        );
      if (meta.isError || offline) return bare(<ErrorState error={meta.error} onRetry={retry} />);
      return bare(<Skeleton />);
    }
    if (day.isError || offline) return bare(<ErrorState error={day.error} onRetry={retry} />);
    return bare(<Skeleton />);
  }

  const message: DayMessage | null = dayMessage(
    data,
    latest,
    countries.length > 0 || favorites.length > 0,
  );
  const shown = data.games.filter((g) => g.rows.length > 0);
  const others = data.games.filter((g) => g.rows.length === 0);
  const loading = day.isPlaceholderData && day.fetchStatus === 'fetching';
  const actions = {
    prev: () => data.prevGameDate && go(data.prevGameDate),
    next: () => data.nextGameDate && go(data.nextGameDate),
    settings: () => router.navigate('/settings'),
  };
  // date is non-null here: without one there is no day data.
  const banner = refreshBanner(meta, day, date ?? data.gameDate, data.gameDate);

  const offLatest = latest !== null && data.gameDate !== latest;

  return screen(
    <>
      <ScrollView
        // The header scrolls away; the strip (child 1) stays reachable at the top.
        stickyHeaderIndices={[1]}
        contentContainerStyle={{
          // Room to scroll the last box out from under the pill.
          paddingBottom: offLatest ? t.layout.target + t.space.xl : 0,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[t.colors.accent]}
            tintColor={t.colors.accent}
            progressBackgroundColor={t.colors.surface}
          />
        }
      >
        {header(data.gameDate)}
        <DayStrip
          date={data.gameDate}
          // While the next day loads, a tap would race the pending step; once the step has
          // failed (paused or error) the strip works again around the kept day on screen.
          disabled={loading}
          onGo={go}
        />
        <View style={[column, { padding: t.space.md, gap: t.space.md }]}>
          {banner ? <Banner text={banner.text} onRetry={banner.retry ? retry : undefined} /> : null}
          {message ? (
            <DayMessageCard
              text={message.text}
              actions={message.actions.map((a) => ({
                label: ACTION_LABELS[a],
                onPress: actions[a],
              }))}
            />
          ) : (
            shown.map((g) => <GameCard key={g.id} game={g} />)
          )}
          {others.length > 0 ? <OtherGames key={data.gameDate} games={others} /> : null}
        </View>
      </ScrollView>
      {offLatest ? (
        <LatestPill
          date={latest}
          // undefined drops the param, so the day follows the latest again.
          onPress={() => router.setParams({ date: undefined })}
        />
      ) : null}
    </>,
  );
}
