import type { ReactNode } from 'react';
import { Pressable, Text, type TextStyle, useWindowDimensions, View } from 'react-native';
import { type Column, columnWidth } from '../lib/stat-table';
import { useTheme } from '../theme';

export type StatTableRow = {
  key: string;
  lead: ReactNode;
  values: string[] | null;
  text?: string;
  label: string;
  onPress: () => void;
  marked?: boolean;
};

// One header row over the rows of one stat kind; each row is a single button for the screen reader.
export function StatTable({
  columns,
  rows,
}: {
  columns: Column[] | null;
  rows: StatTableRow[];
  scroll?: boolean;
}) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  const widths = columns?.map((c) => columnWidth(c.wide, fontScale)) ?? [];
  const cell = (i: number, value: string, color: string, type: TextStyle) => (
    <Text
      key={i}
      style={{
        width: widths[i],
        textAlign: 'right',
        color,
        fontVariant: ['tabular-nums'],
        ...type,
      }}
    >
      {value}
    </Text>
  );
  return (
    <View>
      {columns ? (
        <View style={{ flexDirection: 'row', paddingTop: t.space.xs }}>
          <View style={{ flex: 1 }} />
          {columns.map((c, i) => cell(i, c.label, t.colors.textMuted, t.type.label))}
        </View>
      ) : null}
      {rows.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          onPress={row.onPress}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.space.md,
              minHeight: t.layout.target,
            },
            row.marked && {
              borderLeftWidth: t.layout.markBar,
              borderLeftColor: t.colors.accent,
              paddingLeft: t.space.sm,
              marginLeft: -(t.space.sm + t.layout.markBar),
            },
            pressed && { opacity: t.opacity.pressed },
          ]}
        >
          {/* A text row lets name and text share the width; a stat row gives the name what the columns leave. */}
          <View style={row.values ? { flex: 1 } : { flexShrink: 1 }}>{row.lead}</View>
          {row.values ? (
            <View style={{ flexDirection: 'row' }}>
              {row.values.map((v, i) => cell(i, v, t.colors.text, t.type.body))}
            </View>
          ) : (
            <Text
              style={{
                flexGrow: 1,
                flexShrink: 1,
                textAlign: 'right',
                color: t.colors.textMuted,
                ...t.type.body,
              }}
            >
              {row.text}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
