import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const t = useTheme();
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
        // Wide windows default to beside-icon; the design keeps the label under the icon everywhere.
        tabBarLabelPosition: 'below-icon',
        // The default icon slot is narrower than the pill.
        tabBarIconStyle: { width: t.icon.bar + 2 * t.space.lg },
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarLabelStyle: t.type.label,
        tabBarStyle: {
          // The fixed default (49 + inset) clips a label under the icon; size to the content instead.
          height: 'auto',
          backgroundColor: t.colors.surface,
          borderTopWidth: t.layout.hairline,
          borderTopColor: t.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
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
