import { type ReactNode, useState } from 'react';
import {
  type LayoutChangeEvent,
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
// The fixed name column of a scrolling table takes at most this share, so a stat column always shows.
const LEAD_SHARE = 0.45;

// One header row over the rows of one stat kind; each row is a single button for the screen reader.
// `scroll` (the box score) keeps the names fixed and scrolls every stat column; it runs edge to edge
// in its box and insets the names itself, so the mark bar sits on the box edge and never scrolls away.
export function StatTable({
  columns,
  rows,
  scroll = false,
}: {
  columns: Column[] | null;
  rows: StatTableRow[];
  scroll?: boolean;
}) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  // null until the first layout: side by side until then.
  const [width, setWidth] = useState<number | null>(null);
  // Scrolling, a name lives outside its stat row, so each stat row takes its name's measured height.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = (key: string) => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeights((hs) => (hs[key] === h ? hs : { ...hs, [key]: h }));
  };
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
  if (scroll) {
    const lines = rows.filter((row) => row.values !== null);
    const lead = Math.min(
      t.layout.statLead * Math.max(1, fontScale),
      (width ?? Number.POSITIVE_INFINITY) * LEAD_SHARE,
    );
    const rule = { borderTopWidth: t.layout.hairline, borderTopColor: t.colors.border };
    const inset = (marked?: boolean) =>
      marked
        ? {
            borderLeftWidth: t.layout.markBar,
            borderLeftColor: t.colors.accent,
            paddingLeft: t.space.lg - t.layout.markBar,
          }
        : { paddingLeft: t.space.lg };
    // The padding sits inside each row, so its rule meets the name's rule.
    const statRow = {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingRight: t.space.lg,
    } as const;
    return (
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {lines.length > 0 ? (
          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                width: lead,
                borderRightWidth: t.layout.hairline,
                borderRightColor: t.colors.border,
              }}
            >
              <View style={{ height: heights[''] }} />
              {lines.map((row) => (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  onPress={row.onPress}
                  onLayout={measure(row.key)}
                  style={({ pressed }) => [
                    rule,
                    inset(row.marked),
                    {
                      minHeight: t.layout.target,
                      justifyContent: 'center',
                      paddingVertical: t.space.xs,
                      paddingRight: t.space.sm,
                    },
                    pressed && { opacity: t.opacity.pressed },
                  ]}
                >
                  {row.lead}
                </Pressable>
              ))}
            </View>
            {/* Header and values scroll together; on a wide screen the columns sit right, as on Today. */}
            <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flexGrow: 1 }}>
                {columns ? (
                  <View onLayout={measure('')} style={[statRow, { paddingVertical: t.space.xs }]}>
                    {columns.map((c, i) => cell(i, c.label, t.colors.textMuted, t.type.label))}
                  </View>
                ) : null}
                {lines.map((row) => (
                  <View
                    key={row.key}
                    style={[
                      rule,
                      statRow,
                      { height: heights[row.key], minHeight: t.layout.target },
                    ]}
                  >
                    {row.values?.map((v, i) =>
                      cell(
                        i,
                        v,
                        t.colors.text,
                        columns?.[i]?.strong ? t.type.bodyStrong : t.type.body,
                      ),
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
        {/* A text row has no stat cells, so it spans the box outside the scroller. */}
        {rows
          .filter((row) => row.values === null)
          .map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={row.onPress}
              style={({ pressed }) => [
                rule,
                inset(row.marked),
                {
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  alignContent: 'center',
                  columnGap: t.space.md,
                  minHeight: t.layout.target,
                  paddingVertical: t.space.xs,
                  paddingRight: t.space.lg,
                },
                pressed && { opacity: t.opacity.pressed },
              ]}
            >
              {row.lead}
              <Text style={{ color: t.colors.textMuted, ...t.type.body }}>{row.text}</Text>
            </Pressable>
          ))}
      </View>
    );
  }
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
