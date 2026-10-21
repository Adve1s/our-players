import type { DayGameResponse } from '@our-players/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { GameCard } from './game-card';

// Collapsed on mount; the screen keys it by date so each new day starts collapsed.
export function OtherGames({ games }: { games: DayGameResponse[] }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const title = `Other games (${games.length})`;
  return (
    <View style={{ gap: t.space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        aria-expanded={open}
        onPress={() => setOpen((o) => !o)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: t.space.xl * 2,
          paddingHorizontal: t.space.xs,
        }}
      >
        <Text style={{ color: t.colors.text, fontSize: t.font.body, fontWeight: '600' }}>
          {title}
        </Text>
        <Text style={{ color: t.colors.accent, fontSize: t.font.body }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? games.map((g) => <GameCard key={g.id} game={g} compact />) : null}
    </View>
  );
}
