import Ionicons from '@expo/vector-icons/Ionicons';
// Per-weight imports, so the unused italics stay out of the bundle.
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  type ErrorBoundaryProps,
  Stack,
  ThemeProvider,
} from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { retryQuery } from '../api/queries';
import { RetryMessage } from '../components/error-state';
import { usePrefs } from '../state/prefs-store';
import { useTheme } from '../theme';
import { FONTS } from '../tokens';

// shortcut: the cache lives in memory only, so a cold start offline shows the error; persist it
// when the v2 revisit item (offline after restart) comes up.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: retryQuery, staleTime: 5 * 60_000 } },
});

// Web already refetches on visibilitychange; native needs AppState, so coming back to the app in
// the morning refetches stale meta and moves Today to the new latest day.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (status) => setFocused(status === 'active'));
    return () => sub.remove();
  });
}

// A deep-linked page (/player/…) gets Today beneath it, so its back arrow has somewhere to go.
export const unstable_settings = { anchor: '(tabs)' };

// Until the stored prefs are in, queries would go out with the defaults and then again.
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => usePrefs.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = usePrefs.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(usePrefs.persist.hasHydrated());
    return unsubscribe;
  }, []);
  return hydrated;
}

export default function RootLayout() {
  const t = useTheme();
  const hydrated = useHydrated();
  const [fontsLoaded, fontError] = useFonts({
    [FONTS.regular]: InstrumentSans_400Regular,
    [FONTS.medium]: InstrumentSans_500Medium,
    [FONTS.semiBold]: InstrumentSans_600SemiBold,
    [FONTS.bold]: InstrumentSans_700Bold,
    ...Ionicons.font,
  });
  // A font error falls back to the system font rather than a blank app.
  if (!hydrated || (!fontsLoaded && !fontError)) return null;

  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      primary: t.colors.accent,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.text,
      border: t.colors.border,
      notification: t.colors.danger,
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.colors.background },
            headerShadowVisible: false,
            headerTintColor: t.colors.text,
            headerTitleStyle: t.type.heading,
            contentStyle: { backgroundColor: t.colors.background },
            // The screen below is the tab group, titled "(tabs)"; "Back" makes the label "Go back".
            headerBackTitle: 'Back',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Until the page sets its own title, the header would show the route name. */}
          <Stack.Screen name="player/[id]" options={{ title: 'Player' }} />
          <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
          <Stack.Screen name="install" options={{ title: 'Add to Home Screen' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Replaces the whole layout, so no navigation or query context here; error.message is never shown.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <RetryMessage message="Something went wrong" onRetry={() => void retry()} />
    </View>
  );
}
