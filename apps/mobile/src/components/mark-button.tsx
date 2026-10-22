import type { PublicId } from '@our-players/shared';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { markOf } from '../state/prefs';
import { usePrefs } from '../state/prefs-store';
import { useTheme } from '../theme';

// The ★ and Hide toggles of Search and the player page.
export function MarkButton({
  label,
  checked,
  onPress,
  children,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  children: ReactNode;
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
      {children}
    </Pressable>
  );
}

// Search's and the player page's pair, so the two can't drift.
export function MarkToggles({
  player,
}: {
  player: { id: PublicId; firstName: string; lastName: string };
}) {
  const t = useTheme();
  const mark = usePrefs((s) => markOf(s, player.id));
  const toggleFavorite = usePrefs((s) => s.toggleFavorite);
  const toggleHidden = usePrefs((s) => s.toggleHidden);
  const name = `${player.firstName} ${player.lastName}`;
  return (
    <>
      {/* Hide is the secondary action: small, quiet, away from the edge. */}
      <MarkButton
        label={`Hide ${name}`}
        checked={mark === 'hidden'}
        onPress={() => toggleHidden(player.id)}
      >
        <Text
          style={{
            color: mark === 'hidden' ? t.colors.accent : t.colors.textMuted,
            fontSize: t.font.caption,
          }}
        >
          {mark === 'hidden' ? 'Hidden' : 'Hide'}
        </Text>
      </MarkButton>
      {/* The star is why people search: on the edge, large, in text colour even when off. */}
      <MarkButton
        label={`Favorite ${name}`}
        checked={mark === 'favorite'}
        onPress={() => toggleFavorite(player.id)}
      >
        <Text
          style={{
            color: mark === 'favorite' ? t.colors.accent : t.colors.text,
            fontSize: t.font.icon,
          }}
        >
          {mark === 'favorite' ? '★' : '☆'}
        </Text>
      </MarkButton>
    </>
  );
}
