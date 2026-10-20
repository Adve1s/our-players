import { Text, View } from 'react-native';
import { errorMessage } from '../lib/errors';
import { useTheme } from '../theme';
import { AccentButton } from './accent-button';

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
      <AccentButton label="Try again" onPress={onRetry} />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <RetryMessage message={errorMessage(error)} onRetry={onRetry} />;
}
