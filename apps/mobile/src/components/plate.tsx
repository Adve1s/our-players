import type { DayGameResponse } from '@our-players/shared';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

type TeamScore = DayGameResponse['away'];

// The dark score panel on top of a game box (Today) and the game page.
export function Plate({
  away,
  home,
  status,
  league,
  size = 'card',
  when,
  onPress,
  accessibilityLabel,
}: {
  away: TeamScore;
  home: TeamScore;
  status: string;
  league: string;
  size?: 'card' | 'page';
  when?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const scoreType = size === 'page' ? t.type.scoreLarge : t.type.score;
  // A tie or a game without scores leaves both bright.
  const muted = (own: number | null, other: number | null) =>
    own !== null && other !== null && own < other;
  const side = (team: TeamScore, other: TeamScore, end: boolean) => {
    const abbrev = (
      <Text style={{ color: t.colors.onPlate, ...t.type.heading }}>{team.abbrev}</Text>
    );
    const score =
      team.score === null ? null : (
        <Text
          style={{
            color: muted(team.score, other.score) ? t.colors.onPlateMuted : t.colors.onPlate,
            fontVariant: ['tabular-nums'],
            ...scoreType,
          }}
        >
          {team.score}
        </Text>
      );
    return (
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: end ? 'flex-end' : 'flex-start',
          gap: t.space.md,
        }}
      >
        {end ? score : abbrev}
        {end ? abbrev : score}
      </View>
    );
  };
  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        {side(away, home, false)}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: t.colors.onPlate, ...t.type.bodyStrong }}>{status}</Text>
          <Text style={{ color: t.colors.onPlateMuted, ...t.type.meta }}>{league}</Text>
        </View>
        {side(home, away, true)}
      </View>
      {when ? (
        <Text style={{ color: t.colors.onPlateMuted, textAlign: 'center', ...t.type.meta }}>
          {when}
        </Text>
      ) : null}
    </>
  );
  const box = {
    backgroundColor: t.colors.plate,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.sm,
    minHeight: t.layout.target,
    justifyContent: 'center' as const,
    gap: t.space.sm,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [box, pressed && { opacity: t.opacity.pressed }]}
    >
      {content}
    </Pressable>
  ) : (
    <View accessibilityLabel={accessibilityLabel} style={box}>
      {content}
    </View>
  );
}
