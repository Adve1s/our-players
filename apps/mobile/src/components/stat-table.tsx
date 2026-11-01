import { type ReactNode, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
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

// Past this share of the table's width the columns crowd the name, so each row stacks.
const STACK_SHARE = 0.6;

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
  // null until the first layout: side by side until then.
  const [width, setWidth] = useState<number | null>(null);
  const widths = columns?.map((c) => columnWidth(c.wide, fontScale)) ?? [];
  const total = widths.reduce((sum, w) => sum + w, 0);
  const stacked = width !== null && total > width * STACK_SHARE;
  const scrolls = width !== null && total > width;
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
  const table = (
    <>
      {columns ? (
        <View style={{ flexDirection: 'row', paddingTop: t.space.xs }}>
          <View style={{ flex: 1 }} />
          {columns.map((c, i) => cell(i, c.label, t.colors.textMuted, t.type.label))}
        </View>
      ) : null}
      {rows.map((row) => {
        const stack = stacked && row.values !== null;
        return (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={row.onPress}
            style={({ pressed }) => [
              {
                flexDirection: stack ? 'column' : 'row',
                alignItems: stack ? 'stretch' : 'center',
                justifyContent: 'center',
                gap: stack ? t.space.xs : t.space.md,
                paddingVertical: stack ? t.space.xs : 0,
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
            {/* A text row lets name and text share the width; a stat row gives the name what the columns leave.
                Scrolling, the name keeps the visible width so it wraps where the reader sees it. */}
            <View
              style={
                stack ? (scrolls ? { width } : {}) : row.values ? { flex: 1 } : { flexShrink: 1 }
              }
            >
              {row.lead}
            </View>
            {row.values ? (
              <View style={{ flexDirection: 'row', alignSelf: stack ? 'flex-end' : 'auto' }}>
                {row.values.map((v, i) =>
                  cell(i, v, t.colors.text, columns?.[i]?.strong ? t.type.bodyStrong : t.type.body),
                )}
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
        );
      })}
    </>
  );
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {scrolls ? (
        // Header and values scroll together, one scroller per group.
        <ScrollView horizontal>
          <View style={{ width: total }}>{table}</View>
        </ScrollView>
      ) : (
        table
      )}
    </View>
  );
}
