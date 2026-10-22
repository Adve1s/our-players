import type { DayResponse } from '@our-players/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useDay, useMeta } from '../../api/queries';
import { AccentButton } from '../../components/accent-button';
import { DayMessageCard } from '../../components/day-message';
import { DayStepper } from '../../components/day-stepper';
import { ErrorState } from '../../components/error-state';
import { GameCard } from '../../components/game-card';
import { OtherGames } from '../../components/other-games';
import { Skeleton } from '../../components/skeleton';
import { type DayMessage, dayMessage, refreshBanner } from '../../lib/day-message';
import { dateParam, dateParamFor, latestDate } from '../../lib/format';
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
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radius,
        paddingVertical: t.space.md,
        // Minus the 1px border so the text lines up with card content.
        paddingHorizontal: t.space.lg - 1,
        gap: t.space.md,
        alignItems: 'flex-start',
      }}
    >
      <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{text}</Text>
      {onRetry ? <AccentButton label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

export default function Today() {
  const t = useTheme();
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
  const screen = (child: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>{child}</View>
  );

  if (!data) {
    // A paused query never errors: with nothing cached, offline on web reads as "can't reach".
    const offline = meta.fetchStatus === 'paused' || day.fetchStatus === 'paused';
    if (date === null) {
      // Meta is in but no selected league has a game day.
      if (meta.data)
        return screen(
          <View style={{ padding: t.space.lg }}>
            <DayMessageCard text="No games yet." />
          </View>,
        );
      if (meta.isError || offline) return screen(<ErrorState error={meta.error} onRetry={retry} />);
      return screen(<Skeleton />);
    }
    if (day.isError || offline) return screen(<ErrorState error={day.error} onRetry={retry} />);
    return screen(<Skeleton />);
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

  return screen(
    <>
      <DayStepper
        date={data.gameDate}
        // While the next day loads, the old day's neighbours would step from the wrong day; once
        // the step has failed (paused or error) they are right for the kept day on screen.
        prev={loading ? null : data.prevGameDate}
        next={loading ? null : data.nextGameDate}
        onLatest={param === null || param === latest}
        onGo={go}
        // undefined drops the param, so the day follows the latest again.
        onLatestPress={() => router.setParams({ date: undefined })}
      />
      <ScrollView
        contentContainerStyle={{ padding: t.space.lg, paddingTop: 0, gap: t.space.md }}
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
        {banner ? <Banner text={banner.text} onRetry={banner.retry ? retry : undefined} /> : null}
        {message ? (
          <DayMessageCard
            text={message.text}
            action={
              message.action
                ? { label: ACTION_LABELS[message.action], onPress: actions[message.action] }
                : undefined
            }
          />
        ) : (
          shown.map((g) => <GameCard key={g.id} game={g} />)
        )}
        {others.length > 0 ? <OtherGames key={data.gameDate} games={others} /> : null}
      </ScrollView>
    </>,
  );
}
