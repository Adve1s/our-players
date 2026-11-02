import Ionicons from '@expo/vector-icons/Ionicons';
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
      style={({ pressed }) => ({
        minWidth: t.layout.target,
        minHeight: t.layout.target,
        flexDirection: 'row',
        gap: t.space.xs,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? t.opacity.pressed : 1,
      })}
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
  const hideColor = mark === 'hidden' ? t.colors.accent : t.colors.textMuted;
  return (
    <>
      {/* Hide is the secondary action: muted, away from the edge. */}
      <MarkButton
        label={`Hide ${name}`}
        checked={mark === 'hidden'}
        onPress={() => toggleHidden(player.id)}
      >
        <Ionicons name="eye-off-outline" size={t.icon.bar} color={hideColor} />
        <Text style={{ color: hideColor, ...t.type.bodyStrong }}>
          {mark === 'hidden' ? 'Hidden' : 'Hide'}
        </Text>
      </MarkButton>
      {/* The star is why people search: on the edge and larger than Hide's text. */}
      <MarkButton
        label={`Favorite ${name}`}
        checked={mark === 'favorite'}
        onPress={() => toggleFavorite(player.id)}
      >
        <Ionicons
          name={mark === 'favorite' ? 'star' : 'star-outline'}
          size={t.icon.bar}
          color={mark === 'favorite' ? t.colors.accent : t.colors.textMuted}
        />
      </MarkButton>
    </>
  );
}
