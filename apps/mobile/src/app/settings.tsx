import type { League } from '@our-players/shared';
import Constants from 'expo-constants';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCountries } from '../api/queries';
import { ErrorState } from '../components/error-state';
import { type CountryRow, countryRows } from '../lib/countries';
import { usePrefs } from '../state/prefs-store';
import { useTheme } from '../theme';

const LEAGUES: League[] = ['NHL', 'NBA'];

function Card({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius,
        padding: t.space.lg,
        gap: t.space.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: t.colors.text, fontSize: t.font.title, fontWeight: '600' }}>
          {title}
        </Text>
        {aside ? (
          <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{aside}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Caption({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{children}</Text>;
}

function CountryItem({ row, onPress }: { row: CountryRow; onPress: () => void }) {
  const t = useTheme();
  const counts = LEAGUES.filter((l) => row.counts[l])
    .map((l) => `${l} ${row.counts[l]}`)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: row.selected }}
      accessibilityLabel={row.selected ? `${row.name}, selected` : row.name}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingVertical: t.space.sm,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
      }}
    >
      <Text
        style={{
          color: t.colors.text,
          fontSize: t.font.body,
          fontWeight: '700',
          minWidth: t.space.xl * 2,
        }}
      >
        {row.code}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.text, fontSize: t.font.body }}>{row.name}</Text>
        {counts ? <Caption>{counts}</Caption> : null}
      </View>
      <Text style={{ color: t.colors.accent, fontSize: t.font.title, fontWeight: '700' }}>
        {row.selected ? '✓' : ''}
      </Text>
    </Pressable>
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
  // Without data (loading, error) this still lists the selected countries, so they can be unticked.
  const rows = countryRows(data?.countries ?? [], countries, query);

  let status: ReactNode = null;
  if (isPending && fetchStatus === 'paused') {
    // shortcut: TanStack Query only detects offline on web; add NetInfo if S09's offline banner needs it on Android.
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
      <Card title="Leagues">
        {LEAGUES.map((l) => {
          const on = leagues.includes(l);
          return (
            <View
              key={l}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.colors.text, fontSize: t.font.body }}>{l}</Text>
              <Switch
                accessibilityLabel={l}
                value={on}
                disabled={on && leagues.length === 1}
                onValueChange={() => toggleLeague(l)}
                trackColor={{ true: t.colors.accent, false: t.colors.border }}
                thumbColor={on ? t.colors.onAccent : t.colors.textMuted}
                // react-native-web takes the "on" thumb from this web-only prop (not in RN's types), else teal.
                {...{ activeThumbColor: t.colors.onAccent }}
              />
            </View>
          );
        })}
        {leagues.length === 1 ? <Caption>At least one league stays on.</Caption> : null}
      </Card>

      <Card title="Countries" aside={`${countries.length} selected`}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search countries"
          accessibilityLabel="Search countries"
          autoCorrect={false}
          placeholderTextColor={t.colors.textMuted}
          style={{
            color: t.colors.text,
            fontSize: t.font.body,
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: t.radius,
            paddingHorizontal: t.space.md,
            paddingVertical: t.space.sm,
          }}
        />
        {countries.length === 0 ? (
          <Caption>No countries selected — Today stays empty until you pick one.</Caption>
        ) : null}
        {status}
        {rows.map((row) => (
          <CountryItem key={row.code} row={row} onPress={() => toggleCountry(row.code)} />
        ))}
        {data && rows.length === 0 && query.trim() ? (
          <Caption>No country matches "{query.trim()}".</Caption>
        ) : null}
      </Card>

      <Card title="About">
        <Text style={{ color: t.colors.text, fontSize: t.font.body, fontWeight: '600' }}>
          Our Players
        </Text>
        <Caption>{`Version ${Constants.expoConfig?.version}`}</Caption>
        <Caption>Data from the public NHL and ESPN web APIs.</Caption>
        <Caption>Not affiliated with the NHL or NBA.</Caption>
      </Card>
    </ScrollView>
  );
}
