import { Pressable, Text, View } from 'react-native';
import { errorMessage } from '../lib/errors';
import { useTheme } from '../theme';

// Also the root ErrorBoundary's body, which has its own message.
export function RetryMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.lg,
      }}
    >
      <Text style={{ color: t.colors.text, fontSize: t.font.body, textAlign: 'center' }}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onRetry}
        style={{
          backgroundColor: t.colors.accent,
          borderRadius: t.radius,
          paddingVertical: t.space.md,
          paddingHorizontal: t.space.xl,
        }}
      >
        <Text style={{ color: t.colors.onAccent, fontSize: t.font.body, fontWeight: '600' }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <RetryMessage message={errorMessage(error)} onRetry={onRetry} />;
}
