import { DEFAULT_COUNTRIES, formatFollowing } from '@our-players/shared';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

// Placeholder until S08: proves Metro resolves the shared workspace package.
export default function Home() {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#ffffff' : '#111111';
  return (
    <View style={[styles.container, { backgroundColor: dark ? '#111111' : '#ffffff' }]}>
      <Text style={[styles.title, { color }]}>Our Players</Text>
      <Text style={{ color }}>{formatFollowing(DEFAULT_COUNTRIES)}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
});
