import { Tabs } from 'expo-router';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarIcon: () => null,
        // Without this the empty icon slot pushes the label down and clips it.
        tabBarIconStyle: { display: 'none' },
        // Below-icon items are top-aligned, so a label alone sits high; beside-icon items center.
        tabBarLabelPosition: 'beside-icon',
        tabBarInactiveTintColor: t.colors.textMuted,
        // Zero the beside-icon margins (meant for the gap to an icon) so labels center in their tab.
        tabBarLabelStyle: {
          ...t.type.bodyStrong,
          marginStart: 0,
          marginEnd: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
