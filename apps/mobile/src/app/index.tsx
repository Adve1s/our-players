import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useDay, useMeta } from '../api/queries';
import { DayMessageCard } from '../components/day-message';
import { DayStepper } from '../components/day-stepper';
import { ErrorState } from '../components/error-state';
import { GameCard } from '../components/game-card';
import { OtherGames } from '../components/other-games';
import { type DayMessage, dayMessage, refreshBanner } from '../lib/day-message';
import { dateParam, latestDate } from '../lib/format';
import { usePrefs } from '../state/prefs-store';
import { useTheme } from '../theme';

const ACTION_LABELS = {
  prev: 'Previous game day',
  next: 'Next game day',
  settings: 'Open Settings',
} as const;

function Skeleton() {
  const t = useTheme();
  const bar = (width: `${number}%`) => (
    <View
      style={{
        height: t.space.md,
        width,
        backgroundColor: t.colors.border,
        borderRadius: t.radius,
      }}
    />
  );
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{ padding: t.space.lg, gap: t.space.lg }}
    >
      <View style={{ alignItems: 'center', paddingVertical: t.space.md }}>{bar('40%')}</View>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: t.colors.surface,
            borderRadius: t.radius,
            padding: t.space.lg,
            gap: t.space.md,
          }}
        >
          {bar('60%')}
          {bar('85%')}
        </View>
      ))}
    </View>
  );
}

function Banner({ text }: { text: string }) {
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
      }}
    >
      <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{text}</Text>
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

  const go = (d: string) => router.setParams({ date: d });
  const screen = (child: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>{child}</View>
  );

  if (!day.data) {
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

  const data = day.data;
  const message: DayMessage | null = dayMessage(
    data,
    latest,
    countries.length > 0 || favorites.length > 0,
  );
  const shown = data.games.filter((g) => g.rows.length > 0);
  const others = data.games.filter((g) => g.rows.length === 0);
  const actions = {
    prev: () => data.prevGameDate && go(data.prevGameDate),
    next: () => data.nextGameDate && go(data.nextGameDate),
    settings: () => router.navigate('/settings'),
  };
  const banner = refreshBanner(meta, day);

  return screen(
    <>
      <DayStepper
        date={data.gameDate}
        prev={data.prevGameDate}
        next={data.nextGameDate}
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
        {banner ? <Banner text={banner} /> : null}
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
