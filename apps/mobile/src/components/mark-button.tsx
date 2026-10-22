import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../theme';

// The ★ and Hide toggles of Search and the player page.
export function MarkButton({
  label,
  checked,
  onPress,
  children,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minWidth: t.space.xl * 2,
        minHeight: t.space.xl * 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}
