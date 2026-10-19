import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, Tabs, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { RetryMessage } from '../components/error-state';
import { usePrefs } from '../state/prefs-store';
import { useTheme } from '../theme';

// retry 1: the default 3 with backoff makes "API down" take ~7 s to show.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60_000 } },
});

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
  if (!hydrated) return null;

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
        <Tabs
          screenOptions={{
            tabBarIcon: () => null,
            // Without this the empty icon slot pushes the label down and clips it.
            tabBarIconStyle: { display: 'none' },
            tabBarInactiveTintColor: t.colors.textMuted,
            tabBarLabelStyle: { fontSize: t.font.body, fontWeight: '600' },
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Today' }} />
          <Tabs.Screen name="search" options={{ title: 'Search' }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        </Tabs>
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
