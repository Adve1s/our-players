import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Placeholder({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        backgroundColor: t.colors.background,
      }}
    >
      <Text style={{ color: t.colors.textMuted, fontSize: t.font.body, textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  );
}
