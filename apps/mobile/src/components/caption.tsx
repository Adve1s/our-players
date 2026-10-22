import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme';

export function Caption({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.colors.textMuted, fontSize: t.font.caption }}>{children}</Text>;
}
