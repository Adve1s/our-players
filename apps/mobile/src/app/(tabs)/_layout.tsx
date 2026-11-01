import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const t = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabIcon =
    (active: IconName, idle: IconName) =>
    ({ focused }: { focused: boolean }) => (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: t.space.lg,
          borderRadius: t.radius.full,
          backgroundColor: focused ? t.colors.accentWash : undefined,
        }}
      >
        <Ionicons
          name={focused ? active : idle}
          size={t.icon.bar}
          color={focused ? t.colors.accent : t.colors.textMuted}
        />
      </View>
    );
  return (
    <Tabs
      screenOptions={{
        // Each tab draws its own title.
        headerShown: false,
        // Wide windows default to beside-icon; the design keeps the label under the icon everywhere.
        tabBarLabelPosition: 'below-icon',
        // The default icon slot is narrower than the pill.
        tabBarIconStyle: { width: t.icon.bar + 2 * t.space.lg },
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarLabelStyle: t.type.label,
        tabBarStyle: {
          // The default (49 + inset) clips a label under the icon, and 'auto' collapses the bar's
          // flex: 1 content to zero on native. Fit the uikit item: 5 padding twice, a 28 icon slot, the label.
          height: 2 * 5 + 28 + t.type.label.lineHeight * fontScale + insets.bottom,
          backgroundColor: t.colors.surface,
          borderTopWidth: t.layout.hairline,
          borderTopColor: t.colors.border,
          // The bar spans the window; on wide ones its items sit in the content's centered column.
          // Replaces the bar's default padding, which is the side insets.
          paddingHorizontal: Math.max(insets.left, insets.right, (width - t.layout.maxWidth) / 2),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: tabIcon('calendar', 'calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: tabIcon('search', 'search-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('options', 'options-outline') }}
      />
    </Tabs>
  );
}
