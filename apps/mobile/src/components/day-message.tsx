import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import { AccentButton } from './accent-button';

type Action = { label: string; onPress: () => void };

// The empty/info card for the day states; the wording comes from lib/day-message.
export function DayMessageCard({ text, action }: { text: string; action?: Action }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius,
        padding: t.space.lg,
        gap: t.space.md,
        alignItems: 'flex-start',
      }}
    >
      <Text style={{ color: t.colors.text, fontSize: t.font.body }}>{text}</Text>
      {action ? <AccentButton label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
