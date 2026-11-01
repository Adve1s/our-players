import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import { AccentButton } from './accent-button';

type Action = { label: string; onPress: () => void };

// The empty/info card for the day states; the wording comes from lib/day-message.
export function DayMessageCard({ text, actions = [] }: { text: string; actions?: Action[] }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.sheet,
        padding: t.space.lg,
        gap: t.space.md,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: t.colors.text, textAlign: 'center', ...t.type.body }}>{text}</Text>
      {actions.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: t.space.sm,
          }}
        >
          {actions.map((a) => (
            <AccentButton key={a.label} label={a.label} onPress={a.onPress} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
