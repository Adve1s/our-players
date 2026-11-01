import { View } from 'react-native';
import { useTheme } from '../theme';

// Today, the player page and the game page all load as a title bar over a few cards.
export function Skeleton() {
  const t = useTheme();
  const bar = (width: `${number}%`) => (
    <View
      style={{
        height: t.space.md,
        width,
        backgroundColor: t.colors.border,
        borderRadius: t.radius.sheet,
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
            borderRadius: t.radius.sheet,
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
